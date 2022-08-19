// @ts-check

import fs from "fs-extra";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

import yargs from "yargs";

import * as paths from "./lib/paths.js";

const argv = yargs()
    .help()
    .version(false)
    .option("remove", {
        describe: "Uninstall manifest",
        type: "boolean"
    })
    .parseSync(process.argv);

// Path to newly-built manifest
const newManifestPath = path.join(paths.DIST_PATH, paths.MANIFEST_NAME);
if (!fs.existsSync(newManifestPath) && !argv.remove) {
    console.error("Error: No manifest to install!");
    process.exit(1);
}

console.info(`${argv.remove ? "Uninstalling" : "Installing"} manifest... `);

const platform = os.platform();
switch (platform) {
    // File-based manifests
    case "darwin":
    case "linux": {
        // User-specific manifest within home directory
        const manifestDirectory = path.join(
            os.homedir(),
            platform === "linux"
                ? ".mozilla/native-messaging-hosts"
                : paths.getManifestDirectory(platform, os.arch())
        );

        const manifestPath = path.join(manifestDirectory, paths.MANIFEST_NAME);

        if (argv.remove) {
            // Uninstall manifest
            fs.rmSync(manifestPath);
        } else {
            // Install manifest
            fs.mkdirSync(manifestDirectory, { recursive: true });
            fs.copyFileSync(newManifestPath, manifestPath);
        }

        break;
    }

    case "win32": {
        const registryKey = `HKCU\\SOFTWARE\\Mozilla\\NativeMessagingHosts\\${paths.REGISTRY_KEY}`;

        // Call reg command
        spawnSync(
            argv.remove
                ? `reg delete ${registryKey} /f`
                : `reg add ${registryKey} /ve /d "${newManifestPath}" /f`,
            {
                shell: true,
                stdio: [process.stdin, process.stdout, process.stderr]
            }
        );

        break;
    }

    default:
        console.error("Error: Unsupported platform!");
        process.exit(1);
}
