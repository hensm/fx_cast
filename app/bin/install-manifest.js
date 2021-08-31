const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const minimist = require("minimist");

const paths = require("./lib/paths");

const argv = minimist(process.argv.slice(2), {
    boolean: ["remove"],
    default: {
        remove: false
    }
});

const CURRENT_MANIFEST_PATH = path.join(paths.DIST_PATH, paths.MANIFEST_NAME);

if (!fs.existsSync(CURRENT_MANIFEST_PATH) && !argv.remove) {
    console.error("No manifest in dist/app/ to install.");
    process.exit(1);
}

const platform = os.platform();
const arch = os.arch();

switch (platform) {
    case "darwin":
    case "linux": {
        // Manifest location within home directory
        const destination = path.join(
            os.homedir(),
            platform === "linux"
                ? ".mozilla/native-messaging-hosts/"
                : paths.getManifestPath(platform, arch)
        );

        if (argv.remove) {
            fs.remove(path.join(destination, paths.MANIFEST_NAME));
            break;
        }

        // Install manifest
        fs.ensureDirSync(destination);
        fs.copyFileSync(
            CURRENT_MANIFEST_PATH,
            path.join(destination, paths.MANIFEST_NAME)
        );

        break;
    }

    case "win32": {
        const { Registry } = require("rage-edit");
        const REGISTRY_PATH = `HKCU\\SOFTWARE\\Mozilla\\NativeMessagingHosts\\${paths.REGISTRY_KEY}`;

        if (argv.remove) {
            Registry.delete(REGISTRY_PATH);
            break;
        }

        Registry.set(REGISTRY_PATH, "", CURRENT_MANIFEST_PATH, "REG_SZ");

        break;
    }

    default: {
        console.error("Sorry, this installer does not yet support your OS");
        process.exit(1);
    }
}
