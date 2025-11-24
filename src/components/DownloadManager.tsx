import { ProgressBar, Spinner, ThemeProvider, defaultTheme, extendTheme } from "@inkjs/ui";
import { Box, Text } from "ink";
import { copyFile, mkdir, rename, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { useEffect, useRef, useState } from "react";
import { getDownloadPath } from "../lib/config";
import { getOsuLazerExecutablePath, getOsuStablePath, getOsuStableSongsPath } from "../lib/osu/parser";
import { AVG_BYTES_NO_VIDEO, AVG_BYTES_WITH_VIDEO } from "../lib/size-estimates";

const CONCURRENT_DOWNLOADS = 5;
const MAX_RETRIES = Infinity;
// Average bytes per set used for rough size estimates (imported constants).
const DOWNLOAD_DIR = getDownloadPath();

const customTheme = extendTheme(defaultTheme, {
	components: {
		ProgressBar: {
			styles: {
				completed: () => ({
					color: "#ff69ab"
				})
			}
		},
		Spinner: {
			styles: {
				frame: () => ({
					color: "#ff69ab"
				}),
				label: () => ({
					color: "#ff69ab",
					bold: true
				})
			}
		}
	}
});

interface ActiveDownload {
	id: number;
	currentBytes: number;
	totalBytes: number;
	state: "downloading" | "retrying" | "rate-limited";
	retryTime?: number;
	mirror?: string;
}

interface Props {
	setsToDownload: number[];
	downloadVideo: boolean;
	mapsCount?: number; // total beatmap difficulties across these sets (passed from parent)
	autoImport?: boolean;
	osuVersion?: "stable" | "lazer" | null;
	onDone: (summary: {
		setsAttempted: number;
		setsSucceeded: number;
		setsFailed: number;
		mapsCount: number;
		totalBytes: number;
		elapsedMs: number;
		averageSpeedBytesPerSecond: number;
	}) => void;
}

export default function DownloadManager({
	setsToDownload,
	downloadVideo,
	mapsCount = 0,
	autoImport = false,
	osuVersion = null,
	onDone
}: Props) {
	const [step, setStep] = useState<"init" | "downloading" | "done">("init");
	const [completedSets, setCompletedSets] = useState(0);
	const [failedSets, setFailedSets] = useState<number[]>([]);
	const [activeDownloads, setActiveDownloads] = useState<ActiveDownload[]>([]);
	const [totalBytesDownloaded, setTotalBytesDownloaded] = useState(0);
	const [startTime, setStartTime] = useState(0);
	const startTimeRef = useRef(0);
	const [currentSpeed, setCurrentSpeed] = useState(0); // bytes per second
	const [now, setNow] = useState(Date.now());
	const [termWidth, setTermWidth] = useState(() => process.stdout.columns || 80);

	// Refs for mutable state in the worker loop
	const queueRef = useRef<number[]>([]);
	const activeRef = useRef<Map<number, ActiveDownload>>(new Map());
	const mountedRef = useRef(true);
	const totalBytesRef = useRef(0);

	useEffect(() => {
		return () => {
			mountedRef.current = false;
		};
	}, []);

	// Terminal resize listener to keep progress bar spanning current width.
	useEffect(() => {
		const onResize = () => setTermWidth(process.stdout.columns || 80);
		process.stdout.on("resize", onResize);
		return () => {
			process.stdout.off("resize", onResize);
		};
	}, []);

	useEffect(() => {
		totalBytesRef.current = totalBytesDownloaded;
	}, [totalBytesDownloaded]);

	// Speed calculation interval
	useEffect(() => {
		if (step !== "downloading" || startTime === 0) return;
		const interval = setInterval(() => {
			const currentTime = Date.now();
			setNow(currentTime);
			const elapsedSeconds = (currentTime - startTime) / 1000;
			if (elapsedSeconds > 0) {
				setCurrentSpeed(totalBytesRef.current / elapsedSeconds);
			}
		}, 250);
		return () => clearInterval(interval);
	}, [step, startTime]);

	useEffect(() => {
		const run = async () => {
			queueRef.current = [...setsToDownload];
			await mkdir(DOWNLOAD_DIR, { recursive: true });

			setStep("downloading");
			const ts = Date.now();
			setStartTime(ts);
			startTimeRef.current = ts;
			startWorkers();
		};

		run().catch((err) => {
			console.error(err);
		});
	}, []);

	const updateActiveDownload = (id: number, update: Partial<ActiveDownload>) => {
		if (!mountedRef.current) return;
		const current = activeRef.current.get(id);
		if (current) {
			const updated = { ...current, ...update };
			activeRef.current.set(id, updated);
			// Force update state
			setActiveDownloads(Array.from(activeRef.current.values()));
		}
	};

	const downloadSet = async (setId: number, retryCount = 0): Promise<{ success: boolean; skipped: boolean }> => {
		const filePath = join(DOWNLOAD_DIR, `${setId}.osz`);
		if (await Bun.file(filePath).exists()) {
			setCompletedSets((prev) => prev + 1);
			return { success: true, skipped: true };
		}

		activeRef.current.set(setId, { id: setId, currentBytes: 0, totalBytes: 0, state: "downloading", mirror: "connecting..." });
		setActiveDownloads(Array.from(activeRef.current.values()));

		let lastBytes = 0;
		try {
			const { downloadFromMirrors } = await import("../lib/mirrors");
			const result = await downloadFromMirrors(setId, { downloadVideo }, (update) => {
				const current = activeRef.current.get(setId);
				if (!current) return;
				if (update.status === "rate-limited") {
					updateActiveDownload(setId, { state: "rate-limited", mirror: update.mirror });
					return;
				}
				if (update.status === "error") {
					// Update mirror name even on error so user sees which one failed
					updateActiveDownload(setId, { mirror: update.mirror });
					return;
				}
				// Progress or completion - always update mirror name
				const increment = update.received - lastBytes;
				if (increment > 0) {
					setTotalBytesDownloaded((prev) => prev + increment);
					lastBytes = update.received;
				}
				updateActiveDownload(setId, {
					currentBytes: update.received,
					totalBytes: update.total || current.totalBytes,
					state: "downloading",
					mirror: update.mirror
				});
			});
			await Bun.write(filePath, result.blob);

			if (autoImport) {
				try {
					if (osuVersion === "stable") {
						const osuPath = getOsuStablePath();
						const songsPath = getOsuStableSongsPath(osuPath);
						const targetPath = join(songsPath, `${setId}.osz`);
						try {
							await rename(filePath, targetPath);
						} catch (renameError: any) {
							if (renameError.code === "EXDEV") {
								// Cross-device link not permitted, copy and delete instead
								await copyFile(filePath, targetPath);
								await unlink(filePath);
							} else {
								throw renameError;
							}
						}
					} else if (osuVersion === "lazer") {
						// For lazer, we must open the file with the executable
						const exePath = getOsuLazerExecutablePath();
						let canSpawn = false;

						if (isAbsolute(exePath)) {
							if (await Bun.file(exePath).exists()) {
								canSpawn = true;
							} else {
								console.error(`osu! lazer executable not found at ${exePath}`);
							}
						} else {
							// Assume it's in PATH (e.g. "osu!" on Linux)
							canSpawn = true;
						}

						if (canSpawn) {
							try {
								Bun.spawn([exePath, filePath], { stdout: "ignore", stderr: "ignore" });
							} catch (spawnError) {
								console.error(`Failed to spawn osu! lazer: ${spawnError}`);
							}
						}
					}
				} catch (err) {
					console.error(`Failed to auto-import ${setId}: ${err}`);
				}
			}

			setCompletedSets((prev) => prev + 1);
			return { success: true, skipped: false };
		} catch (error) {
			console.error(`Error downloading ${setId} (attempt ${retryCount + 1}): ${error}`);
			if (retryCount < MAX_RETRIES) {
				updateActiveDownload(setId, { state: "retrying" });
				await new Promise((resolve) => setTimeout(resolve, 5000));
				return await downloadSet(setId, retryCount + 1);
			}
			console.error(`Failed to download ${setId} after ${MAX_RETRIES} retries`);
			setFailedSets((prev) => [...prev, setId]);
			return { success: false, skipped: false };
		} finally {
			activeRef.current.delete(setId);
			setActiveDownloads(Array.from(activeRef.current.values()));
		}
	};

	const startWorkers = async () => {
		const workers: Promise<void>[] = [];

		const worker = async () => {
			while (mountedRef.current && queueRef.current.length > 0) {
				const id = queueRef.current.shift();
				if (id) {
					await downloadSet(id);
				}
			}
		};

		for (let i = 0; i < CONCURRENT_DOWNLOADS; i++) {
			workers.push(worker());
		}

		await Promise.all(workers);
		const endTime = Date.now();
		const elapsedMs = endTime - startTimeRef.current;
		const setsAttempted = setsToDownload.length;
		const setsFailed = failedSets.length;
		const setsSucceeded = setsAttempted - setsFailed;
		const averageSpeedBytesPerSecond = elapsedMs > 0 ? totalBytesRef.current / (elapsedMs / 1000) : 0;
		setStep("done");
		onDone({
			setsAttempted,
			setsSucceeded,
			setsFailed,
			mapsCount,
			totalBytes: totalBytesRef.current,
			elapsedMs,
			averageSpeedBytesPerSecond
		});
	};

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	const formatTime = (ms: number) => {
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		return `${h > 0 ? h + "h " : ""}${m % 60}m ${s % 60}s`;
	};

	const getETA = () => {
		if (setsToDownload.length === 0 || completedSets === 0 || startTime === 0) return "--";
		const elapsedMs = now - startTime;
		if (elapsedMs <= 0) return "--";
		const setsPerMs = completedSets / elapsedMs;
		if (setsPerMs === 0) return "--";
		const remainingSets = Math.max(0, setsToDownload.length - completedSets);
		const etaMs = remainingSets / setsPerMs;
		return formatTime(etaMs);
	};

	const getSizeEstimates = () => {
		const avg = downloadVideo ? AVG_BYTES_WITH_VIDEO : AVG_BYTES_NO_VIDEO;
		const totalExpected = Math.round(avg * setsToDownload.length);
		const remainingSets = Math.max(0, setsToDownload.length - completedSets);
		const remainingExpected = Math.round(avg * remainingSets);
		return { totalExpected, remainingExpected };
	};

	// Inline progress bar with text overlay to save vertical space.
	const InlineProgress = ({ completed, total, failed }: { completed: number; total: number; failed: number }) => {
		const pct = total > 0 ? completed / total : 0;
		const width = Math.max(10, termWidth); // fallback minimum
		let label = `Progress: ${completed}/${total} sets${failed > 0 ? ` (${failed} failed)` : ""}`;
		if (label.length > width) label = label.slice(0, width);
		const padded = label.padEnd(width, " ");
		const filledChars = Math.round(pct * width);
		const filled = padded.slice(0, filledChars);
		const unfilled = padded.slice(filledChars);
		return (
			<Text>
				<Text backgroundColor="#ff69ab" color="black">
					{filled}
				</Text>
				<Text backgroundColor="#333333" color="white">
					{unfilled}
				</Text>
			</Text>
		);
	};

	return (
		<ThemeProvider theme={customTheme}>
			<Box flexDirection="column">
				<Spinner label="Downloading..." />
				<Box height={1} />

				<Box flexDirection="column">
					<InlineProgress completed={completedSets} total={setsToDownload.length} failed={failedSets.length} />

					<Box flexDirection="row" gap={2}>
						<Text>Speed: {formatBytes(currentSpeed)}/s</Text>
						<Text>Downloaded: {formatBytes(totalBytesDownloaded)}</Text>
						{(() => {
							const { totalExpected, remainingExpected } = getSizeEstimates();
							return (
								<Text>
									Est Total: {formatBytes(totalExpected)} | Remaining: {formatBytes(remainingExpected)}
								</Text>
							);
						})()}
						<Text>ETA: {getETA()}</Text>
					</Box>

					{activeDownloads.map((dl) => {
						let statusText = "";
						if (dl.state === "rate-limited" && dl.retryTime) {
							const remaining = Math.max(0, Math.ceil((dl.retryTime - now) / 1000));
							statusText = `(Rate Limited: retrying in ${remaining}s)`;
						} else if (dl.state === "rate-limited") {
							statusText = "(Rate Limited)";
						} else if (dl.state === "retrying") {
							statusText = "(Retrying...)";
						}

						return (
							<Box key={dl.id} flexDirection="column">
								<Box flexDirection="row" justifyContent="space-between">
									<Text>
										Set #{dl.id}
										{dl.mirror && <Text color="cyan"> [{dl.mirror}]</Text>} <Text color="yellow">{statusText}</Text>
									</Text>
									<Text>{dl.totalBytes > 0 ? Math.min(100, Math.round((dl.currentBytes / dl.totalBytes) * 100)) : 0}%</Text>
								</Box>
								<ProgressBar value={dl.totalBytes > 0 ? Math.min(100, (dl.currentBytes / dl.totalBytes) * 100) : 0} />
							</Box>
						);
					})}

					{failedSets.length > 0 && (
						<>
							<Box height={1} />
							<Text bold color="red">
								Failed Downloads:
							</Text>
							<Text color="red">{failedSets.join(", ")}</Text>
						</>
					)}
				</Box>
			</Box>
		</ThemeProvider>
	);
}
