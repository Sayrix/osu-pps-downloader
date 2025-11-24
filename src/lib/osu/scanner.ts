import { existsSync } from "node:fs";
import type { InstalledBeatmap } from "../../types";
import {
	getOsuLazerPath,
	getOsuLazerRealmPath,
	getOsuStableDbPath,
	getOsuStablePath,
	openLazerRealm,
	parseOsuDb
} from "./parser";

export async function getOsuStableBeatmaps(): Promise<InstalledBeatmap[]> {
	let osuPath: string;
	try {
		osuPath = getOsuStablePath();
	} catch {
		return [];
	}

	const dbPath = getOsuStableDbPath(osuPath);

	if (!existsSync(dbPath)) {
		// console.warn(`osu! stable DB not found at ${dbPath}`);
		return [];
	}

	try {
		// console.log("Parsing osu! stable DB...");
		const beatmaps = parseOsuDb(dbPath);
		return beatmaps.map((b) => ({
			...b,
			source: "stable"
		}));
	} catch (error) {
		console.error("Error reading osu! stable DB:", error);
		return [];
	}
}

export async function getOsuLazerBeatmaps(): Promise<InstalledBeatmap[]> {
	const lazerPath = getOsuLazerPath();
	if (!lazerPath) return [];

	const realmPath = getOsuLazerRealmPath(lazerPath);
	const realm = await openLazerRealm(realmPath);

	if (!realm) return [];

	try {
		const sets = realm.objects("BeatmapSet");
		const beatmaps: InstalledBeatmap[] = [];

		for (const set of sets as any) {
			for (const map of set.Beatmaps) {
				beatmaps.push({
					beatmapId: map.OnlineID,
					setId: set.OnlineID,
					artist: map.Metadata.Artist,
					title: map.Metadata.Title,
					version: map.DifficultyName,
					source: "lazer"
				});
			}
		}

		realm.close();
		return beatmaps;
	} catch (error) {
		console.error("Error reading osu! lazer Realm:", error);
		if (!realm.isClosed) realm.close();
		return [];
	}
}
