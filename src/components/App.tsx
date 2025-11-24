import { ProgressBar, Select, ThemeProvider, defaultTheme, extendTheme } from "@inkjs/ui";
import { Box, Text, type TextProps, useApp, useInput } from "ink";
import { useEffect, useMemo, useState } from "react";
import { getSetStarRatings } from "../lib/filter";
import { fetchAndParseDiffsCsv, fetchAndParseMapsetsCsv } from "../lib/osu-pps";
import { getOsuLazerBeatmaps, getOsuStableBeatmaps } from "../lib/osu/scanner";
import { estimateTotalBytes } from "../lib/size-estimates";
import { calculateStats } from "../lib/stats";
import type { BeatmapDiff, BeatmapSet, InstalledBeatmap } from "../types";
import DownloadManager from "./DownloadManager";
import FilterConfig from "./FilterConfig";
import Logo from "./Logo";

const customTheme = extendTheme(defaultTheme, {
	components: {
		ProgressBar: {
			styles: {
				completed: () => ({
					color: "#ff69ab"
				})
			}
		},
		Select: {
			styles: {
				selectedIndicator: () => ({
					color: "#ff69ab"
				}),
				focusIndicator: () => ({
					color: "#ff69ab"
				}),
				label({ isFocused, isSelected }): TextProps {
					let color: string | undefined;

					if (isSelected) {
						color = "#ff69ab";
					}

					if (isFocused) {
						color = "#ff69ab";
					}

					return { color };
				}
			}
		}
	}
});

function App() {
	const { exit } = useApp();
	const [step, setStep] = useState<
		"download-diffs" | "download-mapsets" | "select" | "scan" | "configure" | "downloading" | "done"
	>("download-diffs");

	useInput((_input, _key) => {
		if (step === "done") {
			exit();
		}
	});

	const [downloadSummary, setDownloadSummary] = useState<{
		setsAttempted: number;
		setsSucceeded: number;
		setsFailed: number;
		mapsCount: number;
		totalBytes: number;
		elapsedMs: number;
		averageSpeedBytesPerSecond: number;
	} | null>(null);
	const [progress, setProgress] = useState(0);
	const [diffs, setDiffs] = useState<BeatmapDiff[]>([]);
	const [mapsets, setMapsets] = useState<BeatmapSet[]>([]);
	const [installed, setInstalled] = useState<InstalledBeatmap[]>([]);
	const [osuVersion, setOsuVersion] = useState<"stable" | "lazer" | null>(null);

	// Filter state
	const [minStar, setMinStar] = useState(0);
	const [maxStar, setMaxStar] = useState(10);
	const [downloadVideo, setDownloadVideo] = useState(true);
	const [downloadInstalled, setDownloadInstalled] = useState(false);
	const [autoImport, setAutoImport] = useState(false);
	// Removed storyboard and hitsound settings.
	const [maxSets, setMaxSets] = useState(50);

	const stats = useMemo(() => {
		return calculateStats(diffs);
	}, [diffs]);

	const setStarRatings = useMemo(() => {
		return getSetStarRatings(diffs);
	}, [diffs]);

	const installedSetIds = useMemo(() => {
		return new Set(installed.map((i) => i.setId));
	}, [installed]);

	const availableSets = useMemo(() => {
		return stats.filter((s) => {
			// Filter by star rating
			const rating = setStarRatings.get(s.mapsetId);
			if (!rating) return false;

			// Only exclude if ALL maps are outside the range
			// Exclude if all maps are below minStar OR all maps are above maxStar
			if (rating.maxStar < minStar || rating.minStar > maxStar) {
				return false;
			}

			return true;
		});
	}, [stats, minStar, maxStar, setStarRatings]);

	const filteredSets = useMemo(() => {
		if (downloadInstalled) {
			return availableSets.slice(0, maxSets);
		}

		let count = 0;
		let index = 0;
		for (; index < availableSets.length; index++) {
			if (count >= maxSets) break;
			const s = availableSets[index];
			if (!installedSetIds.has(s.mapsetId)) {
				count++;
			}
		}
		return availableSets.slice(0, index);
	}, [availableSets, maxSets, downloadInstalled, installedSetIds]);

	const setsToDownload = useMemo(() => {
		if (downloadInstalled) return filteredSets;
		return filteredSets.filter((s) => !installedSetIds.has(s.mapsetId));
	}, [filteredSets, downloadInstalled, installedSetIds]);

	const estimatedSize = useMemo(() => {
		return estimateTotalBytes(setsToDownload.length, downloadVideo);
	}, [setsToDownload, downloadVideo]);

	const totalMaps = useMemo(() => {
		return setsToDownload.reduce((acc, s) => acc + s.mapCount, 0);
	}, [setsToDownload]);

	function formatBytes(bytes: number): string {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	}

	function formatTime(ms: number): string {
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		return `${h > 0 ? h + "h " : ""}${m % 60}m ${s % 60}s`;
	}

	useEffect(() => {
		if (step === "download-diffs") {
			fetchAndParseDiffsCsv(undefined, (p) => setProgress(p))
				.then((data) => {
					setDiffs(data);
					setStep("download-mapsets");
					setProgress(0);
				})
				.catch((err) => {
					console.error(err);
					process.exit(1);
				});
		}
	}, [step]);

	useEffect(() => {
		if (step === "download-mapsets") {
			fetchAndParseMapsetsCsv(undefined, (p) => setProgress(p))
				.then((data) => {
					setMapsets(data);
					setStep("select");
				})
				.catch((err) => {
					console.error(err);
					process.exit(1);
				});
		}
	}, [step]);

	useEffect(() => {
		if (step === "scan" && osuVersion) {
			const scan = async () => {
				let maps: InstalledBeatmap[] = [];
				if (osuVersion === "stable") {
					maps = await getOsuStableBeatmaps();
				} else {
					maps = await getOsuLazerBeatmaps();
				}
				setInstalled(maps);
				setStep("configure");
			};
			scan();
		}
	}, [step, osuVersion]);

	return (
		<ThemeProvider theme={customTheme}>
			<Box flexDirection="column" padding={1}>
				<Logo />
				<Box height={1} />

				{(step === "download-diffs" || step === "download-mapsets") && (
					<Box flexDirection="column">
						<Text>
							{step === "download-diffs"
								? "Downloading and processing beatmaps from osu-pps..."
								: "Downloading and processing mapsets from osu-pps..."}
						</Text>
						<ProgressBar value={progress} />
						<Text color="gray">{progress}%</Text>
					</Box>
				)}

				{step === "select" && (
					<Box flexDirection="column">
						<Text>Select osu! version:</Text>
						<Select
							options={[
								{ label: "osu!stable", value: "stable" },
								{ label: "osu!lazer", value: "lazer" }
							]}
							onChange={(value) => {
								setOsuVersion(value as "stable" | "lazer");
								setStep("scan");
							}}
						/>
					</Box>
				)}

				{step === "configure" && (
					<FilterConfig
						totalSets={setsToDownload.length}
						availableSetsCount={availableSets.length}
						totalMaps={totalMaps}
						estimatedSize={estimatedSize}
						minStar={minStar}
						maxStar={maxStar}
						setMinStar={setMinStar}
						setMaxStar={setMaxStar}
						downloadVideo={downloadVideo}
						setDownloadVideo={setDownloadVideo}
						downloadInstalled={downloadInstalled}
						setDownloadInstalled={setDownloadInstalled}
						autoImport={autoImport}
						setAutoImport={setAutoImport}
						maxSets={maxSets}
						setMaxSets={setMaxSets}
						onStart={() => setStep("downloading")}
						items={filteredSets}
						installed={installed}
						mapsets={mapsets}
						diffs={diffs}
						allSets={availableSets}
					/>
				)}

				{step === "downloading" && (
					<DownloadManager
						setsToDownload={setsToDownload.map((s) => s.mapsetId)}
						downloadVideo={downloadVideo}
						mapsCount={totalMaps}
						autoImport={autoImport}
						osuVersion={osuVersion}
						onDone={(summary) => {
							setDownloadSummary(summary);
							setStep("done");
						}}
					/>
				)}

				{step === "done" && downloadSummary && (
					<Box flexDirection="column">
						<Text color="green" bold>
							All downloads finished!
						</Text>
						<Box height={1} />
						<Text>
							Sets downloaded: {downloadSummary.setsSucceeded}/{downloadSummary.setsAttempted} (Failed:{" "}
							{downloadSummary.setsFailed})
						</Text>
						<Text>Maps (difficulties): {downloadSummary.mapsCount}</Text>
						<Text>Data downloaded: {formatBytes(downloadSummary.totalBytes)}</Text>
						<Text>
							Elapsed: {formatTime(downloadSummary.elapsedMs)} | Avg speed:{" "}
							{formatBytes(downloadSummary.averageSpeedBytesPerSecond)}/s
						</Text>
						<Box height={1} />
						<Text>
							Loaded {stats.length} sets ({stats.reduce((acc, s) => acc + s.mapCount, 0)} beatmaps) from osu-pps.
						</Text>
						<Text>
							Found {new Set(installed.map((i) => i.setId)).size} installed sets ({installed.length} beatmaps) in osu!{" "}
							{osuVersion}.
						</Text>
						<Box height={1} />
						<Text color="gray">Press any key to exit</Text>
					</Box>
				)}
			</Box>
		</ThemeProvider>
	);
}

export default App;
