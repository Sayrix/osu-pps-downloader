import { getDebug } from "./config";

export function initDebugLog() {
	if (getDebug()) {
		console.log(`--- Debug Log Started ${new Date().toISOString()} ---`);
	}
}

export function logDebug(message: string, data?: any) {
	if (getDebug()) {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] ${message}`);
		if (data !== undefined) {
			console.log(JSON.stringify(data, null, 2));
		}
	}
}
