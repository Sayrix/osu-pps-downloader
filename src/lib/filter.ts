import type { BeatmapDiff } from "../types";

export interface SetStarRating {
	mapsetId: number;
	minStar: number;
	maxStar: number;
}

export function getSetStarRatings(diffs: BeatmapDiff[]): Map<number, SetStarRating> {
	const map = new Map<number, SetStarRating>();

	for (const diff of diffs) {
		const existing = map.get(diff.mapsetId);
		if (existing) {
			existing.minStar = Math.min(existing.minStar, diff.difficulty);
			existing.maxStar = Math.max(existing.maxStar, diff.difficulty);
		} else {
			map.set(diff.mapsetId, {
				mapsetId: diff.mapsetId,
				minStar: diff.difficulty,
				maxStar: diff.difficulty
			});
		}
	}
	return map;
}
