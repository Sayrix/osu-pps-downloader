import fs from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const version = "20.2.0";
const baseUrl = `https://static.realm.io/realm-js-prebuilds/${version}`;
const targets = ["linux-x64", "linux-arm64", "darwin-arm64", "win32-x64"];

const outDir = join(process.cwd(), "src", "lib", "realm-binaries");

async function downloadAndExtract(target: string) {
	const destPath = join(outDir, `realm-${target}.node`);
	if (fs.existsSync(destPath)) {
		console.log(`Skipping ${target} (already exists)`);
		return;
	}

	const url = `${baseUrl}/realm-v${version}-napi-v6-${target}.tar.gz`;
	console.log(`Downloading ${target} from ${url}...`);

	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);

	const arrayBuffer = await response.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);
	const tarPath = join(outDir, `${target}.tar.gz`);

	await writeFile(tarPath, buffer);

	console.log(`Extracting ${target}...`);

	// Use system tar command which is available on Windows 10+ and Unix
	// We extract only realm.node and rename it
	// But tar extraction usually preserves paths.
	// The archive structure usually has realm.node at root or inside build/Release

	// Let's try to use a temporary directory for extraction
	const tmpDir = join(outDir, `tmp-${target}`);
	await mkdir(tmpDir, { recursive: true });

	const proc = Bun.spawn(["tar", "-xzf", tarPath, "-C", tmpDir]);
	await proc.exited;

	// Find realm.node in tmpDir
	// It might be in build/Release/realm.node or just realm.node
	// We'll search recursively

	let foundPath: string | null = null;

	function findRealmNode(dir: string) {
		const files = fs.readdirSync(dir);
		for (const file of files) {
			const fullPath = join(dir, file);
			const stat = fs.statSync(fullPath);
			if (stat.isDirectory()) {
				findRealmNode(fullPath);
			} else if (file === "realm.node") {
				foundPath = fullPath;
			}
		}
	}

	findRealmNode(tmpDir);

	if (foundPath) {
		const destPath = join(outDir, `realm-${target}.node`);
		await fs.promises.rename(foundPath, destPath);
		console.log(`Saved to ${destPath}`);
	} else {
		console.error(`Could not find realm.node in extracted files for ${target}`);
	}

	// Cleanup
	await unlink(tarPath);
	await fs.promises.rm(tmpDir, { recursive: true, force: true });
}

(async () => {
	await mkdir(outDir, { recursive: true });
	for (const target of targets) {
		await downloadAndExtract(target);
	}
	console.log("Done!");
})();
