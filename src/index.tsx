import { render } from "ink";
import { dirname } from "node:path";
import App from "./components/App";
import { getDownloadPath } from "./lib/config";
import { initDebugLog, logDebug } from "./lib/debug";
import { getOsuLazerPath, getOsuStablePath } from "./lib/osu/parser";

(async () => {
	// If running as a standalone executable, change CWD to the executable directory
	// This fixes issues when opening from Windows Search (where CWD is System32 or User Profile)
	if (!process.execPath.endsWith("bun.exe")) {
		try {
			process.chdir(dirname(process.execPath));
		} catch (e) {
			// Ignore
		}
	}

	initDebugLog();

	try {
		logDebug("Application started");
		logDebug("process.cwd()", process.cwd());
		logDebug("process.execPath", process.execPath);
		logDebug("process.argv", process.argv);

		try {
			logDebug("getOsuLazerPath()", getOsuLazerPath());
		} catch (e: any) {
			logDebug("getOsuLazerPath() error", e.message);
		}

		try {
			logDebug("getOsuStablePath()", getOsuStablePath());
		} catch (e: any) {
			logDebug("getOsuStablePath() error", e.message);
		}

		logDebug("getDownloadPath()", getDownloadPath());
	} catch (e: any) {
		logDebug("Error during startup logging", e.message);
	}

	const app = render(<App />);

	await app.waitUntilExit();
})();
