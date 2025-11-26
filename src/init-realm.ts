// @ts-expect-error - Importing .node files
import realmDarwinArm64 from "./lib/realm-binaries/realm-darwin-arm64.node" with { type: "file" };
// @ts-expect-error - Importing .node files
import realmLinuxArm64 from "./lib/realm-binaries/realm-linux-arm64.node" with { type: "file" };
// @ts-expect-error - Importing .node files
import realmLinux64 from "./lib/realm-binaries/realm-linux-x64.node" with { type: "file" };
// @ts-expect-error - Importing .node files
import realmWin64 from "./lib/realm-binaries/realm-win32-x64.node" with { type: "file" };

let realmPath: string | undefined;

if (process.platform === "win32" && process.arch === "x64") {
	realmPath = realmWin64;
} else if (process.platform === "linux" && process.arch === "x64") {
	realmPath = realmLinux64;
} else if (process.platform === "linux" && process.arch === "arm64") {
	realmPath = realmLinuxArm64;
} else if (process.platform === "darwin" && process.arch === "arm64") {
	realmPath = realmDarwinArm64;
}

if (realmPath) {
	process.env.REALM_BINDING_PATH = realmPath;
} else {
	console.warn(`Unsupported platform/arch: ${process.platform}-${process.arch}. Realm might fail to load.`);
}
