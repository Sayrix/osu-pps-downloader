import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { BeatmapDiff, BeatmapSet, InstalledBeatmap } from "../types";
import BeatmapList, { type BeatmapSetStat } from "./BeatmapList";

interface Props {
	totalSets: number;
	availableSetsCount: number;
	totalMaps: number;
	estimatedSize: number;
	minStar: number;
	maxStar: number;
	setMinStar: (v: number) => void;
	setMaxStar: (v: number) => void;
	downloadVideo: boolean;
	setDownloadVideo: (v: boolean) => void;
	downloadInstalled: boolean;
	setDownloadInstalled: (v: boolean) => void;
	autoImport: boolean;
	setAutoImport: (v: boolean) => void;
	maxSets: number;
	setMaxSets: (v: number) => void;
	onStart: () => void;
	items: BeatmapSetStat[];
	installed: InstalledBeatmap[];
	mapsets: BeatmapSet[];
	diffs: BeatmapDiff[]; // for SR min/max
	allSets: BeatmapSetStat[];
}

// Step logic:
// - 5 increments up to 50
// - 50 increments up to 500
// - 100 increments up to 5000
// - 1000 increments beyond
// Additionally clamp the minimum value to 5 (never 0) so "under 50 max sets, it goes from 5 to 5".
function getNextStep(current: number, direction: 1 | -1): number {
	let step: number;
	if (current < 50)
		step = 5; // grow in 5s until 50
	else if (current < 500)
		step = 50; // then 50s until 500
	else if (current < 5000)
		step = 100; // then 100s until 5000
	else step = 1000; // beyond 5000 grow by 1000

	let next = current + step * direction;
	if (next < 5) next = 5;
	return next;
}

export default function FilterConfig({
	totalSets,
	availableSetsCount,
	totalMaps,
	estimatedSize,
	minStar,
	maxStar,
	setMinStar,
	setMaxStar,
	downloadVideo,
	setDownloadVideo,
	downloadInstalled,
	setDownloadInstalled,
	autoImport,
	setAutoImport,
	maxSets,
	setMaxSets,
	onStart,
	items,
	installed,
	mapsets,
	diffs,
	allSets
}: Props) {
	const [activeField, setActiveField] = useState<
		"minStar" | "maxStar" | "maxSets" | "video" | "installed" | "autoImport" | "start" | "list"
	>("minStar");

	useInput((input, key) => {
		const fields = ["minStar", "maxStar", "maxSets", "video", "installed", "autoImport", "start", "list"] as const;
		if (key.rightArrow) {
			const idx = fields.indexOf(activeField);
			setActiveField(fields[(idx + 1) % fields.length]);
		}
		if (key.leftArrow) {
			const idx = fields.indexOf(activeField);
			setActiveField(fields[(idx - 1 + fields.length) % fields.length]);
		}

		if (activeField === "minStar") {
			if (key.downArrow) setMinStar(Math.max(0, Number((minStar - 0.1).toFixed(1))));
			if (key.upArrow) setMinStar(Math.min(maxStar, Number((minStar + 0.1).toFixed(1))));
		}
		if (activeField === "maxStar") {
			if (key.downArrow) setMaxStar(Math.max(minStar, Number((maxStar - 0.1).toFixed(1))));
			if (key.upArrow) setMaxStar(Number((maxStar + 0.1).toFixed(1)));
		}
		if (activeField === "video") {
			if (key.upArrow || key.downArrow || key.return) setDownloadVideo(!downloadVideo);
		}
		if (activeField === "installed") {
			if (key.upArrow || key.downArrow || key.return) setDownloadInstalled(!downloadInstalled);
		}
		if (activeField === "autoImport") {
			if (key.upArrow || key.downArrow || key.return) setAutoImport(!autoImport);
		}
		if (activeField === "maxSets") {
			if (key.downArrow) setMaxSets(getNextStep(maxSets, -1));
			if (key.upArrow) {
				const nextValue = getNextStep(maxSets, 1);
				setMaxSets(Math.min(nextValue, availableSetsCount));
			}
		}
		if (activeField === "start") {
			if (key.return) onStart();
		}
	});

	const formatSize = (bytes: number) => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB", "TB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	return (
		<Box flexDirection="column" padding={0}>
			<Box flexDirection="row" justifyContent="space-between">
				<Text bold underline>
					Download Configuration
				</Text>
				<Text color="gray">Use Left/Right to navigate, Up/Down to adjust.</Text>
			</Box>

			<Box flexDirection="row" justifyContent="space-between">
				<Box width="33%">
					<Text color={activeField === "minStar" ? "#ff69ab" : undefined}>
						{activeField === "minStar" ? "> " : "  "}Minimum SR: {minStar.toFixed(1)}
					</Text>
				</Box>
				<Box width="33%">
					<Text color={activeField === "maxStar" ? "#ff69ab" : undefined}>
						{activeField === "maxStar" ? "> " : "  "}Maximum SR: {maxStar.toFixed(1)}
					</Text>
				</Box>
				<Box width="33%">
					<Text color={activeField === "maxSets" ? "#ff69ab" : undefined}>
						{activeField === "maxSets" ? "> " : "  "}Max Sets: {maxSets}
					</Text>
				</Box>
			</Box>

			<Box flexDirection="row" justifyContent="space-between">
				<Box width="33%">
					<Text color={activeField === "video" ? "#ff69ab" : undefined}>
						{activeField === "video" ? "> " : "  "}Download Video: {downloadVideo ? "Yes" : "No"}
					</Text>
				</Box>
				<Box width="33%">
					<Text color={activeField === "installed" ? "#ff69ab" : undefined}>
						{activeField === "installed" ? "> " : "  "}Download Installed: {downloadInstalled ? "Yes" : "No"}
					</Text>
				</Box>
				<Box width="33%">
					<Text color={activeField === "autoImport" ? "#ff69ab" : undefined}>
						{activeField === "autoImport" ? "> " : "  "}Auto Import: {autoImport ? "Yes" : "No"}
					</Text>
				</Box>
			</Box>

			<Box height={1} />

			<Box flexDirection="row" justifyContent="center">
				<Text color={activeField === "start" ? "green" : undefined} bold={activeField === "start"}>
					{activeField === "start" ? "> " : "  "}[ Start ]
				</Text>
			</Box>

			<Box height={1} />

			<BeatmapList
				items={items}
				installed={installed}
				mapsets={mapsets}
				diffs={diffs}
				isActive={activeField === "list"}
				downloadInstalled={downloadInstalled}
				headerSuffix={`| Sets: ${totalSets} | Maps: ${totalMaps} | Est. Size: ${formatSize(estimatedSize)}`}
				allSets={allSets}
				setMaxSets={setMaxSets}
			/>
		</Box>
	);
}
