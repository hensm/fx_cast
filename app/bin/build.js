const fs = require("fs-extra");
const os = require("os");
const path = require("path");

const { spawnSync } = require("child_process");
const { exec: pkgExec } = require("pkg");

const argv = require("minimist")(process.argv.slice(2));


const MANIFEST_NAME = "fx_cast_bridge.json";

const BUILD_DIR_PATH = path.join(__dirname, "../build");
const DIST_DIR_PATH = path.join(__dirname, "../../dist/app");

try {
    // Make directories
    fs.mkdirSync(BUILD_DIR_PATH);
    fs.mkdirSync(DIST_DIR_PATH, { recursive: true });
} catch (err) {}


const executableName = {
    win32: "bridge.exe"
  , darwin: "bridge"
  , linux: "bridge"
};

const executablePath = {
    win32: "C:\\Program Files\\fx_cast\\"
  , darwin: "/Library/Application Support/fx_cast/"
  , linux: "/opt/fx_cast/"
};

const manifestPath = {
    darwin: "/Library/Application Support/Mozilla/NativeMessagingHosts/"
  , linux: "/usr/lib/mozilla/native-messaging-hosts/"
};

const pkgPlatform = {
    win32: "win"
  , darwin: "macos"
  , linux: "linux"
};


async function build () {
    const platform = argv.platform || os.platform();

    // Run Babel
    spawnSync(`babel src -d ${BUILD_DIR_PATH} --copy-files `
      , { shell: true });

    // Add build platform's executable path to the manifest
    const manifest = {
        ...(JSON.parse(fs.readFileSync(MANIFEST_NAME, "utf8")))
      , path: path.join(executablePath[platform], executableName[platform])
    };

    // Write manifest
    fs.writeFileSync(path.join(BUILD_DIR_PATH, MANIFEST_NAME)
          , JSON.stringify(manifest, null, 4));


    // File permissions
    for (const file of fs.readdirSync(BUILD_DIR_PATH)) {
        fs.chmodSync(path.resolve(BUILD_DIR_PATH, file), 0o755);
    }


    const pkgInfo = {
        name: "bridge"
      , bin: "main.js"
      , pkg: {
            // Workaround for pkg asset detection
            // https://github.com/thibauts/node-castv2/issues/46
            "assets": "../node_modules/castv2/lib/cast_channel.proto"
        }
    };

    fs.writeFileSync(path.join(BUILD_DIR_PATH, "package.json")
          , JSON.stringify(pkgInfo))

    // Package executable
    await pkgExec([
        BUILD_DIR_PATH
      , "--target", pkgPlatform[platform]
      , "--output", path.join(BUILD_DIR_PATH, executableName[platform])
    ]);

    if (argv.package) {
        const installerName = await buildInstaller(platform);

        // Move installer to dist
        fs.moveSync(path.join(BUILD_DIR_PATH, installerName)
              , path.join(DIST_DIR_PATH, installerName)
              , { overwrite: true });
    } else {
        // Move binary / app manifest
        fs.moveSync(path.join(BUILD_DIR_PATH, MANIFEST_NAME)
              , path.join(DIST_DIR_PATH, MANIFEST_NAME)
              , { overwrite: true });
        fs.moveSync(path.join(BUILD_DIR_PATH, executableName[platform])
              , path.join(DIST_DIR_PATH, executableName[platform])
              , { overwrite: true });
    }

    // Remove build directory
    fs.removeSync(BUILD_DIR_PATH); 
}

async function buildInstaller (platform) {
    switch (platform) {
        case "darwin": {
            const installerName = "fx_cast_bridge.pkg";

            // Create pkgbuild root
            const rootPath = path.join(BUILD_DIR_PATH, "root");
            const rootExecutablePath = path.join(rootPath
                  , executablePath[platform]);
            const rootManifestPath = path.join(rootPath
                  , manifestPath[platform]);

            // Create install locations
            fs.mkdirSync(rootExecutablePath, { recursive: true });
            fs.mkdirSync(rootManifestPath, { recursive: true });

            // Move files to root
            fs.moveSync(path.join(BUILD_DIR_PATH, executableName[platform])
                  , path.join(rootExecutablePath, executableName[platform]));
            fs.moveSync(path.join(BUILD_DIR_PATH, MANIFEST_NAME)
                  , path.join(rootManifestPath, MANIFEST_NAME));

            // Build installer package
            spawnSync(
                `pkgbuild --root ${rootPath} `
                       + `--identifier "tf.matt.fx_cast_bridge" `
                       + `--version "0.0.1" `
                       + `${path.join(BUILD_DIR_PATH, installerName)}`
              , { shell: true });

            return installerName;
        };

        case "win32":
        case "linux":
            // TODO: installers

        default:
            console.log("Cannot build installer package for this platform");
    }
}

build().catch(e => {
    console.log("Build failed", e);
    process.exit(1);
});
