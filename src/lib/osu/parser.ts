import fs from "fs";
import { homedir } from "os";
import path from "path";
import type { LightBeatmap } from "../../types";

// --- osu! stable ---

export function getOsuStablePath(): string {
	if (process.platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA;
		if (!localAppData) throw new Error("LOCALAPPDATA environment variable not found");
		return path.join(localAppData, "osu!");
	}
	// Fallback for other platforms (e.g. running via Wine)
	// Users might need to configure this manually if they are running stable on Linux/Mac
	return path.join(homedir(), ".osu");
}

export function getOsuStableSongsPath(osuPath: string): string {
	return path.join(osuPath, "Songs");
}

export function getOsuStableDbPath(osuPath: string): string {
	return path.join(osuPath, "osu!.db");
}

export function getOsuStableExecutablePath(): string {
	if (process.platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA;
		if (!localAppData) throw new Error("LOCALAPPDATA environment variable not found");
		return path.join(localAppData, "osu!", "osu!.exe");
	}
	return "osu!";
}

// Simple ULEB128 decoder
function readULEB128(buffer: Buffer, offset: number): { value: number; bytesRead: number } {
	let result = 0;
	let shift = 0;
	let bytesRead = 0;
	while (true) {
		const byte = buffer[offset + bytesRead];
		bytesRead++;
		result |= (byte & 0x7f) << shift;
		if ((byte & 0x80) === 0) break;
		shift += 7;
	}
	return { value: result, bytesRead };
}

// String reader for osu! binary format
function readOsuString(buffer: Buffer, offset: number): { value: string; bytesRead: number } {
	const type = buffer[offset];
	if (type === 0x00) {
		return { value: "", bytesRead: 1 };
	}
	if (type === 0x0b) {
		const { value: length, bytesRead: lengthBytes } = readULEB128(buffer, offset + 1);
		const str = buffer.toString("utf8", offset + 1 + lengthBytes, offset + 1 + lengthBytes + length);
		return { value: str, bytesRead: 1 + lengthBytes + length };
	}
	throw new Error(`Unknown string type: ${type} at offset ${offset}`);
}

function skipOsuString(buffer: Buffer, offset: number): number {
	const type = buffer[offset];
	if (type === 0x00) {
		return 1;
	}
	if (type === 0x0b) {
		const { value: length, bytesRead: lengthBytes } = readULEB128(buffer, offset + 1);
		return 1 + lengthBytes + length;
	}
	throw new Error(`Unknown string type: ${type} at offset ${offset}`);
}

export function parseOsuDb(dbPath: string): LightBeatmap[] {
	const buffer = fs.readFileSync(dbPath);
	let offset = 0;

	// Version (Int)
	const version = buffer.readInt32LE(offset);
	offset += 4;

	// Folder Count (Int)
	offset += 4;

	// AccountUnlocked (Bool)
	offset += 1;

	// Date unlocked (DateTime - 8 bytes)
	offset += 8;

	// Player name (String)
	offset += skipOsuString(buffer, offset);

	// Number of beatmaps (Int)
	const numberOfBeatmaps = buffer.readInt32LE(offset);
	offset += 4;

	const beatmaps: LightBeatmap[] = [];

	for (let i = 0; i < numberOfBeatmaps; i++) {
		// Size in bytes (Int) - Only if version < 20191106.
		if (version < 20191106) {
			offset += 4;
		}

		const artist = readOsuString(buffer, offset);
		offset += artist.bytesRead;

		offset += skipOsuString(buffer, offset); // Artist Unicode

		const title = readOsuString(buffer, offset);
		offset += title.bytesRead;

		offset += skipOsuString(buffer, offset); // Title Unicode
		offset += skipOsuString(buffer, offset); // Creator

		const difficulty = readOsuString(buffer, offset);
		offset += difficulty.bytesRead;

		offset += skipOsuString(buffer, offset); // Audio
		offset += skipOsuString(buffer, offset); // MD5
		offset += skipOsuString(buffer, offset); // FileName

		// Ranked status (Byte)
		offset += 1;

		// Hitcircles (Short)
		offset += 2;

		// Sliders (Short)
		offset += 2;

		// Spinners (Short)
		offset += 2;

		// Last modification time (Long)
		offset += 8;

		// AR, CS, HP, OD (Byte or Single depending on version)
		if (version < 20140609) {
			offset += 4; // 4 bytes
		} else {
			offset += 16; // 4 floats * 4 bytes
		}

		// Slider velocity (Double)
		offset += 8;

		// Star Rating info (Int-Float pairs) for 4 modes
		if (version >= 20140609) {
			for (let j = 0; j < 4; j++) {
				const count = buffer.readInt32LE(offset);
				offset += 4;
				const pairSize = version < 20250107 ? 14 : 10;
				offset += count * pairSize;
			}
		}

		// Drain time (Int)
		offset += 4;
		// Total time (Int)
		offset += 4;
		// Audio preview time (Int)
		offset += 4;

		// Timing points
		const timingPointCount = buffer.readInt32LE(offset);
		offset += 4;
		// Timing point: Double (8) + Double (8) + Bool (1) = 17 bytes
		offset += timingPointCount * 17;

		// Difficulty ID (Int) -> This is actually the Beatmap ID
		const beatmapId = buffer.readInt32LE(offset);
		offset += 4;

		// Beatmap ID (Int) -> This is actually the Set ID
		const setId = buffer.readInt32LE(offset);
		offset += 4;

		// Thread ID (Set ID) (Int) -> This seems to be 0 or unused
		offset += 4;

		// Grades (4 bytes)
		offset += 4;

		// Local offset (Short)
		offset += 2;

		// Stack leniency (Single)
		offset += 4;

		// Mode (Byte)
		offset += 1;

		// Source (String)
		offset += skipOsuString(buffer, offset);

		// Tags (String)
		offset += skipOsuString(buffer, offset);

		// Online offset (Short)
		offset += 2;

		// Font (String)
		offset += skipOsuString(buffer, offset);

		// Is unplayed (Bool)
		offset += 1;

		// Last played (Long)
		offset += 8;

		// Is osz2 (Bool)
		offset += 1;

		// Folder name (String)
		offset += skipOsuString(buffer, offset);

		// Last checked (Long)
		offset += 8;

		// Ignore sound, skin, storyboard, video, visual override (5 Bools)
		offset += 5;

		// Unknown (Short) if version < 20140609
		if (version < 20140609) {
			offset += 2;
		}

		// Last mod time (Int)
		offset += 4;

		// Mania scroll speed (Byte)
		offset += 1;

		beatmaps.push({
			artist: artist.value,
			title: title.value,
			version: difficulty.value,
			beatmapId,
			setId
		});
	}

	return beatmaps;
}
// --- osu! lazer ---

export function getOsuLazerPath(): string {
	if (process.platform === "win32") {
		const appData = process.env.APPDATA;
		if (!appData) throw new Error("APPDATA environment variable not found");
		return path.join(appData, "osu");
	} else if (process.platform === "darwin") {
		return path.join(homedir(), "Library", "Application Support", "osu");
	} else {
		// Linux and others
		return path.join(homedir(), ".local", "share", "osu");
	}
}

export function getOsuLazerFilesPath(lazerPath: string): string {
	return path.join(lazerPath, "files");
}

export function getOsuLazerRealmPath(lazerPath: string): string {
	return path.join(lazerPath, "client.realm");
}

export function getOsuLazerExecutablePath(): string {
	if (process.platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA;
		if (!localAppData) throw new Error("LOCALAPPDATA environment variable not found");
		// Lazer usually installs to %LOCALAPPDATA%/osulazer/current/osu!.exe
		return path.join(localAppData, "osulazer", "current", "osu!.exe");
	} else if (process.platform === "darwin") {
		return "/Applications/osu!.app/Contents/MacOS/osu!";
	} else {
		// Linux
		// Try to find it in PATH or return a common AppImage location?
		// For now, let's assume it's in the PATH or the user can run it as "osu!"
		return "osu!";
	}
}

// Note: This requires the 'realm' package to be installed.
// npm install realm
export async function openLazerRealm(realmPath: string) {
	// Dynamic import to avoid crashing if realm is not installed
	try {
		const Realm = (await import("realm")).default;

		const FileSchema = {
			name: "File",
			primaryKey: "Hash",
			properties: {
				Hash: "string?"
			}
		};

		const RealmNamedFileUsageSchema = {
			name: "RealmNamedFileUsage",
			embedded: true,
			properties: {
				File: "File",
				Filename: "string?"
			}
		};

		const RealmUserSchema = {
			name: "RealmUser",
			properties: {
				OnlineID: "int",
				Username: "string?"
			}
		};

		const BeatmapMetadataSchema = {
			name: "BeatmapMetadata",
			properties: {
				Title: "string?",
				TitleUnicode: "string?",
				Artist: "string?",
				ArtistUnicode: "string?",
				Author: "RealmUser"
			}
		};

		const BeatmapSchema = {
			name: "Beatmap",
			primaryKey: "ID",
			properties: {
				ID: "uuid",
				DifficultyName: "string?",
				OnlineID: "int",
				Metadata: "BeatmapMetadata"
			}
		};

		const BeatmapSetSchema = {
			name: "BeatmapSet",
			primaryKey: "ID",
			properties: {
				ID: "uuid",
				OnlineID: "int",
				DateAdded: "date",
				Beatmaps: "Beatmap[]",
				Files: "RealmNamedFileUsage[]",
				DeletePending: "bool",
				Hash: "string?",
				Protected: "bool"
			}
		};

		// Check version to avoid errors if possible, but we pass it to open
		const version = Realm.schemaVersion(realmPath);

		return await Realm.open({
			path: realmPath,
			schema: [BeatmapSetSchema, BeatmapSchema, BeatmapMetadataSchema, RealmNamedFileUsageSchema, FileSchema, RealmUserSchema],
			schemaVersion: version,
			readOnly: true
		});
	} catch (e) {
		console.error("Failed to load Realm or open database. Make sure 'realm' is installed.", e);
		return null;
	}
}
