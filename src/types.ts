export interface BeatmapDiffLegacy {
	m: number; // mods
	b: number; // beatmap id
	x: number; // farmability value (legacy) -> farmValue
	pp99: number;
	adj: number;
	v: string;
	s: number; // mapset id
	l: number;
	d: number;
	p: number;
	h: number;
	appr_h: number;
	cs: number;
	ar: number;
	accuracy: number;
	drain: number;
}

export interface BeatmapDiff {
	beatmapId: number;
	mapsetId: number;
	farmValue: number;
	mods: number;
	pp: number | null;
	adjusted: number;
	version: string;
	length: number;
	difficulty: number;
	passCount: number;
	hoursSinceRanked: number;
	approvedHoursTimestamp: number;
	maniaKeys?: number;
	ar: number;
	cs: number;
	accuracy: number;
	drain: number;
	overweightness: number;
}

export interface LightBeatmap {
	beatmapId: number;
	setId: number;
	artist: string;
	title: string;
	version: string;
}

export interface InstalledBeatmap extends LightBeatmap {
	source: "stable" | "lazer";
}

export interface BeatmapSetLegacy {
	art: string;
	t: string;
	bpm: number;
	s: number;
}

export interface BeatmapSet {
	artist: string;
	title: string;
	bpm: number;
	mapsetId: number;
}
