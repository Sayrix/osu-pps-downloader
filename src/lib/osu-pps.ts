import { parseStream } from "fast-csv";
import { Readable } from "node:stream";
import type { BeatmapDiff, BeatmapDiffLegacy, BeatmapSet, BeatmapSetLegacy } from "../types";

export function normalizeBeatmap(diff: BeatmapDiffLegacy): BeatmapDiff {
	return {
		beatmapId: diff.b,
		mapsetId: diff.s,
		farmValue: diff.x,
		mods: diff.m,
		pp: diff.pp99 ?? null,
		adjusted: diff.adj,
		version: diff.v,
		length: diff.l,
		difficulty: diff.d,
		passCount: diff.p,
		hoursSinceRanked: diff.h,
		approvedHoursTimestamp: diff.appr_h,
		maniaKeys: diff.cs, // legacy used cs for mania keys in repo code
		ar: diff.ar,
		cs: diff.cs,
		accuracy: diff.accuracy,
		drain: diff.drain,
		overweightness: (1000 * diff.x) / (diff.adj || 1) ** 0.65 / (diff.h || 1) ** 0.35
	};
}

/**
 * Fetch diffs.csv from the raw URL and parse into normalized BeatmapDiff[].
 *
 * @param url - raw CSV url (defaults to the data branch diffs.csv)
 * @param onProgress - optional callback for download progress (0-100)
 * @returns Promise resolving to an array of BeatmapDiff
 */
export async function fetchAndParseDiffsCsv(
	url = "https://raw.githubusercontent.com/grumd/osu-pps/refs/heads/data/data/maps/osu/diffs.csv",
	onProgress?: (_percent: number) => void
): Promise<BeatmapDiff[]> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch diffs.csv: ${res.status} ${res.statusText}`);
	}

	const contentLength = res.headers.get("content-length");
	const total = contentLength ? parseInt(contentLength, 10) : 0;
	let loaded = 0;

	if (!res.body) throw new Error("Response body is null");

	// Create a readable stream from the fetch body to track progress
	const reader = res.body.getReader();
	const stream = new Readable({
		async read() {
			const { done, value } = await reader.read();
			if (done) {
				this.push(null);
			} else {
				loaded += value.length;
				if (total > 0 && onProgress) {
					onProgress(Math.min(100, Math.round((loaded / total) * 100)));
				}
				this.push(Buffer.from(value));
			}
		}
	});

	return new Promise((resolve, reject) => {
		const results: BeatmapDiff[] = [];

		parseStream(stream, { headers: true })
			.on("error", (error) => reject(error))
			.on("data", (rowRaw: any) => {
				// Row values are strings by default in fast-csv unless configured otherwise.
				// We coerce them safely to numbers/strings:
				function coerceNum(v: unknown): number {
					if (v === null || v === undefined || v === "") return 0;
					if (typeof v === "number") return v;
					const n = Number(v);
					return Number.isNaN(n) ? 0 : n;
				}

				const legacy: BeatmapDiffLegacy = {
					m: coerceNum(rowRaw["m"]),
					b: coerceNum(rowRaw["b"]),
					x: coerceNum(rowRaw["x"]),
					pp99: coerceNum(rowRaw["pp99"]),
					adj: coerceNum(rowRaw["adj"]),
					v: (rowRaw["v"] ?? "") as string,
					s: coerceNum(rowRaw["s"]),
					l: coerceNum(rowRaw["l"]),
					d: coerceNum(rowRaw["d"]),
					p: coerceNum(rowRaw["p"]),
					h: coerceNum(rowRaw["h"]),
					appr_h: coerceNum(rowRaw["appr_h"]),
					ar: coerceNum(rowRaw["ar"]),
					accuracy: coerceNum(rowRaw["accuracy"]),
					cs: coerceNum(rowRaw["cs"]),
					drain: coerceNum(rowRaw["drain"])
				};

				results.push(normalizeBeatmap(legacy));
			})
			.on("end", () => resolve(results));
	});
}

/**
 * Fetch mapsets.csv from the raw URL and parse into normalized BeatmapSet[].
 *
 * @param url - raw CSV url (defaults to the data branch mapsets.csv)
 * @param onProgress - optional callback for download progress (0-100)
 * @returns Promise resolving to an array of BeatmapSet
 */
export async function fetchAndParseMapsetsCsv(
	url = "https://raw.githubusercontent.com/grumd/osu-pps/refs/heads/data/data/maps/osu/mapsets.csv",
	onProgress?: (_percent: number) => void
): Promise<BeatmapSet[]> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch mapsets.csv: ${res.status} ${res.statusText}`);
	}

	const contentLength = res.headers.get("content-length");
	const total = contentLength ? parseInt(contentLength, 10) : 0;
	let loaded = 0;

	if (!res.body) throw new Error("Response body is null");

	const reader = res.body.getReader();
	const stream = new Readable({
		async read() {
			const { done, value } = await reader.read();
			if (done) {
				this.push(null);
			} else {
				loaded += value.length;
				if (total > 0 && onProgress) {
					onProgress(Math.min(100, Math.round((loaded / total) * 100)));
				}
				this.push(Buffer.from(value));
			}
		}
	});

	return new Promise((resolve, reject) => {
		const results: BeatmapSet[] = [];

		parseStream(stream, { headers: true })
			.on("error", (error) => reject(error))
			.on("data", (rowRaw: any) => {
				function coerceNum(v: unknown): number {
					if (v === null || v === undefined || v === "") return 0;
					if (typeof v === "number") return v;
					const n = Number(v);
					return Number.isNaN(n) ? 0 : n;
				}

				const legacy: BeatmapSetLegacy = {
					art: (rowRaw["art"] ?? "") as string,
					t: (rowRaw["t"] ?? "") as string,
					bpm: coerceNum(rowRaw["bpm"]),
					s: coerceNum(rowRaw["s"])
				};

				results.push({
					artist: legacy.art,
					title: legacy.t,
					bpm: legacy.bpm,
					mapsetId: legacy.s
				});
			})
			.on("end", () => resolve(results));
	});
}
