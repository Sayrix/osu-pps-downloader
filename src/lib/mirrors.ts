import { AVG_BYTES_NO_VIDEO, AVG_BYTES_WITH_VIDEO } from "./size-estimates";

interface MirrorOptions {
	downloadVideo: boolean;
}

interface MirrorDescriptor {
	name: string;
	buildUrl: (_setId: number, _opts: MirrorOptions) => string;
}

// Mirror list. Each mirror may support a subset of query params.
// We attempt allowed mirrors concurrently and keep the first successful full download.
const MIRRORS: MirrorDescriptor[] = [
	{
		name: "osu.direct",
		buildUrl: (setId, opts) => {
			const qs = !opts.downloadVideo ? "?noVideo=1" : "";
			return `https://osu.direct/api/d/${setId}${qs}`;
		}
	},
	{
		name: "nerinyan",
		buildUrl: (setId, opts) => {
			const qs = !opts.downloadVideo ? "?noVideo=1" : "";
			return `https://api.nerinyan.moe/d/${setId}${qs}`;
		}
	},
	{
		name: "mimo",
		buildUrl: (setId, opts) => {
			// Add n to ID to disable video
			const idPart = opts.downloadVideo ? `${setId}` : `${setId}n`;
			return `https://catboy.best/d/${idPart}`;
		}
	},
	{
		// No support for any flag.
		name: "nekoha",
		buildUrl: (setId) => `https://mirror.nekoha.moe/api4/download/${setId}`
	}
];

export interface MirrorProgressUpdate {
	mirror: string;
	received: number;
	total: number;
	status: "downloading" | "rate-limited" | "error" | "completed" | "blacklisted";
	error?: string;
}

interface MirrorHealth {
	rateLimitCount: number;
	failCount: number;
	successCount: number;
	blacklistUntil?: number;
}

const mirrorHealth = new Map<string, MirrorHealth>();

function getOrInitHealth(name: string): MirrorHealth {
	let h = mirrorHealth.get(name);
	if (!h) {
		h = { rateLimitCount: 0, failCount: 0, successCount: 0 };
		mirrorHealth.set(name, h);
	}
	return h;
}

function isBlacklisted(name: string): boolean {
	const h = mirrorHealth.get(name);
	if (!h || !h.blacklistUntil) return false;
	if (Date.now() >= h.blacklistUntil) {
		delete h.blacklistUntil;
		return false;
	}
	return true;
}

function registerRateLimit(name: string) {
	const h = getOrInitHealth(name);
	h.rateLimitCount += 1;
	// Blacklist when 2+ consecutive 429s; duration escalates.
	if (h.rateLimitCount >= 2) {
		const durationMs = Math.min(120_000, 20_000 * h.rateLimitCount); // cap at 2 minutes
		h.blacklistUntil = Date.now() + durationMs;
	}
}

function registerFailure(name: string) {
	const h = getOrInitHealth(name);
	h.failCount += 1;
	// Blacklist after 3 failures (non-429) for a short period.
	if (h.failCount >= 3) {
		h.blacklistUntil = Date.now() + 30_000; // 30s
	}
}

function registerSuccess(name: string) {
	const h = getOrInitHealth(name);
	h.successCount += 1;
	// Decay penalties gradually.
	if (h.rateLimitCount > 0) h.rateLimitCount -= 1;
	if (h.failCount > 0) h.failCount -= 1;
	if (h.blacklistUntil && h.successCount % 2 === 0) {
		// Early pardon after enough successes.
		delete h.blacklistUntil;
	}
}

export function getMirrorHealthSnapshot(): Record<string, MirrorHealth> {
	const out: Record<string, MirrorHealth> = {};
	for (const [k, v] of mirrorHealth) out[k] = { ...v };
	return out;
}

export async function downloadFromMirrors(
	setId: number,
	ops: MirrorOptions,
	onProgress?: (_update: MirrorProgressUpdate) => void
): Promise<{ blob: Blob; mirror: string; totalBytes: number }> {
	// Pick mirrors that are not currently blacklisted.
	let candidates = MIRRORS.filter((m) => !isBlacklisted(m.name));
	if (candidates.length === 0) {
		// Force one mirror (soonest expiry) so we don't deadlock.
		candidates = [...MIRRORS]
			.sort((a, b) => (getOrInitHealth(a.name).blacklistUntil || 0) - (getOrInitHealth(b.name).blacklistUntil || 0))
			.slice(0, 1);
		const forced = candidates[0];
		onProgress?.({
			mirror: forced.name,
			received: 0,
			total: 0,
			status: "blacklisted",
			error: "Forced attempt while blacklisted"
		});
	}

	// Sort by a rough health score (lower penalties first).
	candidates = candidates.sort((a, b) => {
		const ha = getOrInitHealth(a.name);
		const hb = getOrInitHealth(b.name);
		const scoreA = ha.rateLimitCount * 2 + ha.failCount - ha.successCount * 0.25;
		const scoreB = hb.rateLimitCount * 2 + hb.failCount - hb.successCount * 0.25;
		return scoreA - scoreB;
	});

	const controllers = candidates.map(() => new AbortController());
	let resolved = false;
	let failures = 0;

	return new Promise((resolve, reject) => {
		candidates.forEach((mirror, idx) => {
			(async () => {
				try {
					const url = mirror.buildUrl(setId, ops);
					const controller = controllers[idx];
					const response = await fetch(url, { signal: controller.signal });

					// Some mirrors (e.g., Sayobot) return HTTP 200 with HTML error pages
					// instead of proper error codes. We validate responses to avoid saving
					// corrupted 2KB HTML files as .osz archives.

					if (response.status === 429) {
						registerRateLimit(mirror.name);
						onProgress?.({ mirror: mirror.name, received: 0, total: 0, status: "rate-limited" });
						failures++;
						if (!resolved && failures === candidates.length) {
							reject(new Error("All mirrors rate-limited or failed"));
						}
						return;
					}

					if (!response.ok) {
						registerFailure(mirror.name);
						onProgress?.({ mirror: mirror.name, received: 0, total: 0, status: "error", error: `Status ${response.status}` });
						failures++;
						if (!resolved && failures === candidates.length) {
							reject(new Error("All mirrors failed"));
						}
						return;
					}

					// Validate content type - reject HTML responses (mirror errors)
					const contentType = response.headers.get("content-type") || "";
					if (contentType.includes("text/html") || contentType.includes("application/json")) {
						registerFailure(mirror.name);
						onProgress?.({
							mirror: mirror.name,
							received: 0,
							total: 0,
							status: "error",
							error: "Invalid content type (not a beatmap file)"
						});
						failures++;
						if (!resolved && failures === candidates.length) {
							reject(new Error("All mirrors failed"));
						}
						return;
					}

					const contentLength = response.headers.get("content-length");
					// Use estimated size if Content-Length is missing (e.g., nekoha mirror)
					const total = contentLength
						? parseInt(contentLength, 10)
						: Math.round(ops.downloadVideo ? AVG_BYTES_WITH_VIDEO : AVG_BYTES_NO_VIDEO);

					// Reject suspiciously small files (< 10KB) - likely error pages
					if (total > 0 && total < 10240) {
						registerFailure(mirror.name);
						onProgress?.({
							mirror: mirror.name,
							received: 0,
							total: 0,
							status: "error",
							error: `File too small (${total} bytes)`
						});
						failures++;
						if (!resolved && failures === candidates.length) {
							reject(new Error("All mirrors failed"));
						}
						return;
					}

					const reader = response.body?.getReader();
					if (!reader) {
						registerFailure(mirror.name);
						failures++;
						onProgress?.({ mirror: mirror.name, received: 0, total: 0, status: "error", error: "No body" });
						if (!resolved && failures === candidates.length) reject(new Error("All mirrors failed"));
						return;
					}

					const chunks: Uint8Array[] = [];
					let received = 0;
					onProgress?.({ mirror: mirror.name, received, total, status: "downloading" });
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						if (resolved) {
							controller.abort();
							return;
						}
						chunks.push(value);
						received += value.length;
						onProgress?.({ mirror: mirror.name, received, total, status: "downloading" });
					}

					if (!resolved) {
						resolved = true;
						controllers.forEach((c, j) => {
							if (j !== idx) c.abort();
						});

						// Final validation: ensure we got a reasonable amount of data
						if (received < 10240) {
							registerFailure(mirror.name);
							onProgress?.({
								mirror: mirror.name,
								received,
								total,
								status: "error",
								error: `Downloaded file too small (${received} bytes)`
							});
							reject(new Error("Downloaded file appears to be corrupted or an error page"));
							return;
						}

						registerSuccess(mirror.name);
						onProgress?.({ mirror: mirror.name, received, total, status: "completed" });
						const combined = new Uint8Array(received);
						let offset = 0;
						for (const chunk of chunks) {
							combined.set(chunk, offset);
							offset += chunk.length;
						}
						resolve({ blob: new Blob([combined]), mirror: mirror.name, totalBytes: received });
					}
				} catch (err: any) {
					if (resolved) return;
					registerFailure(mirror.name);
					failures++;
					onProgress?.({ mirror: mirror.name, received: 0, total: 0, status: "error", error: String(err) });
					if (failures === candidates.length) {
						reject(new Error("All mirrors failed"));
					}
				}
			})();
		});
	});
}

export const mirrorNames = MIRRORS.map((m) => m.name);
