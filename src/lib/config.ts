import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CONFIG_FILE = join(process.cwd(), "config.txt");
let cachedDownloadPath: string | undefined;

function parseConfigFile(): Record<string, string> {
	const result: Record<string, string> = {};
	if (!existsSync(CONFIG_FILE)) return result;
	try {
		const raw = readFileSync(CONFIG_FILE, "utf8");
		for (const line of raw.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
			const eqIndex = trimmed.indexOf("=");
			if (eqIndex === -1) continue;
			const key = trimmed.slice(0, eqIndex).trim().toUpperCase();
			let value = trimmed.slice(eqIndex + 1).trim();
			// eslint-disable-next-line quotes
			if ((value.startsWith(`"`) && value.endsWith(`"`)) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}
			result[key] = value;
		}
	} catch {
		// Ignore parse errors
	}
	return result;
}

export function getDownloadPath(): string {
	if (cachedDownloadPath) return cachedDownloadPath;
	const cfg = parseConfigFile();
	let rawPath = cfg["DOWNLOAD_PATH"] || "./download";
	if (rawPath.startsWith(".") || rawPath.startsWith("./") || rawPath.startsWith(".\\")) {
		rawPath = resolve(process.cwd(), rawPath);
	}
	cachedDownloadPath = rawPath;
	return cachedDownloadPath;
}
