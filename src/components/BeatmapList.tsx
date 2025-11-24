import { Box, Text, useInput } from "ink";
import { useMemo, useState } from "react";
import { getSetStarRatings } from "../lib/filter";
import type { BeatmapSet, InstalledBeatmap } from "../types";

export interface BeatmapSetStat {
	mapsetId: number;
	avgOverweightness: number;
	mapCount: number;
}

interface Props {
	items: BeatmapSetStat[];
	installed: InstalledBeatmap[];
	mapsets: BeatmapSet[];
	diffs?: any[]; // Optional: BeatmapDiff[] for SR info
	isActive?: boolean;
	headerSuffix?: string;
	downloadInstalled?: boolean;
	allSets?: BeatmapSetStat[];
	setMaxSets?: (n: number) => void;
}

export default function BeatmapList({
	items,
	installed,
	mapsets,
	diffs,
	isActive = true,
	headerSuffix,
	downloadInstalled = false,
	allSets,
	setMaxSets
}: Props) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [scrollTop, setScrollTop] = useState(0);
	const visibleItems = 10;

	const mapsetsMap = useMemo(() => {
		const map = new Map<number, BeatmapSet>();
		for (const m of mapsets) {
			map.set(m.mapsetId, m);
		}
		return map;
	}, [mapsets]);

	const installedMapMap = useMemo(() => {
		const map = new Map<number, InstalledBeatmap>();
		for (const m of installed) {
			map.set(m.setId, m);
		}
		return map;
	}, [installed]);

	useInput((input, key) => {
		if (!isActive) return;
		if (key.upArrow) {
			const newIndex = Math.max(0, selectedIndex - 1);
			setSelectedIndex(newIndex);
			if (newIndex < scrollTop) {
				setScrollTop(Math.max(0, scrollTop - 5));
			}
		}
		if (key.downArrow) {
			const newIndex = Math.min(items.length - 1, selectedIndex + 1);
			setSelectedIndex(newIndex);
			if (newIndex >= scrollTop + visibleItems) {
				setScrollTop(Math.min(items.length - visibleItems, scrollTop + 5));
			}
		}
		if (key.pageUp) {
			const newIndex = Math.max(0, selectedIndex - visibleItems);
			setSelectedIndex(newIndex);
			if (newIndex < scrollTop) {
				setScrollTop(newIndex);
			}
		}
		if (key.pageDown) {
			const newIndex = Math.min(items.length - 1, selectedIndex + visibleItems);
			setSelectedIndex(newIndex);
			if (newIndex >= scrollTop + visibleItems) {
				setScrollTop(newIndex - visibleItems + 1);
			}
		}
		if (input === "j") {
			// Find next uninstalled map
			let nextIndex = -1;
			const searchList = allSets || items;
			for (let i = selectedIndex + 1; i < searchList.length; i++) {
				if (!installedMapMap.has(searchList[i].mapsetId)) {
					nextIndex = i;
					break;
				}
			}

			if (nextIndex !== -1) {
				if (nextIndex >= items.length && setMaxSets) {
					setMaxSets(nextIndex + 1);
				}
				setSelectedIndex(nextIndex);
				setScrollTop(nextIndex);
			}
		}
	});

	const displayedItems = items.slice(scrollTop, scrollTop + visibleItems);

	// Use getSetStarRatings to get min/max SR for each set
	const setStarRatings = useMemo(() => {
		if (diffs && Array.isArray(diffs)) {
			return getSetStarRatings(diffs);
		}
		return new Map();
	}, [diffs]);

	function getMinMaxSR(mapsetId: number): { min: number | null; max: number | null } {
		const rating = setStarRatings.get(mapsetId);
		if (!rating) return { min: null, max: null };
		return { min: rating.minStar, max: rating.maxStar };
	}

	return (
		<Box flexDirection="column">
			<Text bold underline>
				Top Overweight Beatmap Sets (Average) {headerSuffix}
			</Text>
			{displayedItems.map((item, index) => {
				const realIndex = scrollTop + index;
				const isSelected = isActive && realIndex === selectedIndex;

				// Try to find metadata from installed maps
				const installedMap = installedMapMap.get(item.mapsetId);
				const mapset = mapsetsMap.get(item.mapsetId);
				const label = installedMap
					? `${installedMap.artist} - ${installedMap.title}`
					: mapset
						? `${mapset.artist} - ${mapset.title}`
						: `Mapset #${item.mapsetId}`;

				// Get min/max SR for this set
				const { min, max } = getMinMaxSR(item.mapsetId);

				const willInstall = !installedMap || downloadInstalled;
				const statusEmoji = willInstall ? "📥" : "🔴";

				return (
					<Box key={item.mapsetId}>
						<Text color={isSelected ? "#ff69ab" : installedMap ? "#b88a9e" : undefined}>
							{isSelected ? "> " : "  "}
							{statusEmoji} #{realIndex + 1} {/* <Link url={`https://osu.ppy.sh/beatmapsets/${item.mapsetId}`}>{label}</Link> */}
							{label}
						</Text>
						<Box marginLeft={1}>
							<Text color="gray">
								(🚜 Avg: {item.avgOverweightness.toFixed(0)}, Maps: {item.mapCount}
								{typeof min === "number" && typeof max === "number" ? `, SR: ${min.toFixed(2)}–${max.toFixed(2)}` : ""})
							</Text>
						</Box>
					</Box>
				);
			})}
			{isActive && (
				<>
					<Box height={1} />
					<Text color="gray">
						Use Up/Down arrows to scroll, 'j' to jump to uninstalled. Showing {scrollTop + 1}-
						{Math.min(scrollTop + visibleItems, items.length)} of {items.length}.
					</Text>
				</>
			)}
		</Box>
	);
}
