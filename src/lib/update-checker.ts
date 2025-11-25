import { version } from "../../package.json";

export async function checkForUpdates(): Promise<string | null> {
	try {
		const response = await fetch("https://api.github.com/repos/Sayrix/osu-pps-downloader/releases/latest");
		if (!response.ok) return null;
		const data = await response.json();
		const latestVersion = data.tag_name.replace(/^v/, "");

		if (isNewer(version, latestVersion)) {
			return latestVersion;
		}
	} catch {
		// Ignore errors
	}
	return null;
}

function isNewer(current: string, latest: string): boolean {
	const c = current.split(".").map(Number);
	const l = latest.split(".").map(Number);
	for (let i = 0; i < Math.max(c.length, l.length); i++) {
		const cv = c[i] || 0;
		const lv = l[i] || 0;
		if (lv > cv) return true;
		if (lv < cv) return false;
	}
	return false;
}
