import type { BeatmapSetStat } from "../components/BeatmapList";
import type { BeatmapDiff } from "../types";

export function calculateStats(diffs: BeatmapDiff[]): BeatmapSetStat[] {
	if (diffs.length === 0) return [];

	// Map<mapsetId, Map<beatmapId, maxOverweightness>>
	const mapsets = new Map<number, Map<number, number>>();

	for (const diff of diffs) {
		let setMaps = mapsets.get(diff.mapsetId);
		if (!setMaps) {
			setMaps = new Map<number, number>();
			mapsets.set(diff.mapsetId, setMaps);
		}

		const currentMax = setMaps.get(diff.beatmapId);
		if (currentMax === undefined || diff.overweightness > currentMax) {
			setMaps.set(diff.beatmapId, diff.overweightness);
		}
	}

	const result: BeatmapSetStat[] = [];
	for (const [mapsetId, beatmaps] of mapsets.entries()) {
		let totalOverweightness = 0;
		let count = 0;

		for (const overweightness of beatmaps.values()) {
			totalOverweightness += overweightness;
			count++;
		}

		result.push({
			mapsetId,
			avgOverweightness: totalOverweightness / count,
			mapCount: count
		});
	}

	return result.sort((a, b) => b.avgOverweightness - a.avgOverweightness);
}
