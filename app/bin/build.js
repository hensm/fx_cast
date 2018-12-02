const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const minimist = require("minimist");
const glob = require("glob");

const { spawnSync } = require("child_process");
const { exec: pkgExec } = require("pkg");

const { executableName
      , executablePath
      , manifestName
      , manifestPath
      , pkgPlatform
      , DIST_PATH } = require("./lib/paths");


const argv = minimist(process.argv.slice(2), {
    boolean: [ "package" ]
  , string: [ "platform", "packageType" ]
  , default: {
        platform: os.platform()
      , package: false
        // Linux package type (deb/rpm)
      , packageType: "deb"
    }
});

const BUILD_PATH = path.join(__dirname, "../build");


// Clean
fs.removeSync(BUILD_PATH);
fs.removeSync(DIST_PATH);

// Make directories
fs.ensureDirSync(BUILD_PATH);
fs.ensureDirSync(DIST_PATH, { recursive: true });


async function build () {
    // Run Babel
    spawnSync(`babel src -d ${BUILD_PATH} --copy-files `
      , { shell: true });

    // Add either installed path or dist path to app manifest
    const manifest = JSON.parse(fs.readFileSync(manifestName, "utf8"));
    manifest.path = argv.package
        ? path.join(executablePath[argv.platform], executableName[argv.platform])
        : path.join(DIST_PATH, executableName[argv.platform]);

    // Write manifest
    fs.writeFileSync(path.join(BUILD_PATH, manifestName)
          , JSON.stringify(manifest, null, 4));


    // File permissions
    for (const file of fs.readdirSync(BUILD_PATH)) {
        fs.chmodSync(path.resolve(BUILD_PATH, file), 0o755);
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

    fs.writeFileSync(path.join(BUILD_PATH, "package.json")
          , JSON.stringify(pkgInfo))

    // Package executable
    await pkgExec([
        BUILD_PATH
      , "--target", pkgPlatform[argv.platform]
      , "--output", path.join(BUILD_PATH, executableName[argv.platform])
    ]);

    if (argv.package) {
        const installerName = await package(argv.platform);

        if (installerName) {
            // Move installer to dist
            fs.moveSync(path.join(BUILD_PATH, installerName)
                  , path.join(DIST_PATH, path.basename(installerName))
                  , { overwrite: true });
        }
    } else {
        // Move binary / app manifest
        fs.moveSync(path.join(BUILD_PATH, manifestName)
              , path.join(DIST_PATH, manifestName)
              , { overwrite: true });
        fs.moveSync(path.join(BUILD_PATH, executableName[argv.platform])
              , path.join(DIST_PATH, executableName[argv.platform])
              , { overwrite: true });
    }

    // Remove build directory
    fs.removeSync(BUILD_PATH);
}


function package (platform) {
    switch (platform) {
        case "darwin":
            return packageDarwin();

        case "linux":
            switch (argv.packageType) {
                case "deb":
                    return packageLinuxDeb();
                case "rpm":
                    return packageLinuxRpm();
            }

        case "win32":
            return packageWin32();

        default:
            console.log("Cannot build installer package for this platform");
    }
}

function packageDarwin () {
    const installerName = "fx_cast_bridge.pkg";
    const componentName = "fx_cast_bridge_component.pkg";

    const packagingDir = path.join(__dirname, "../packaging/mac/");

    // Create pkgbuild root
    const rootPath = path.join(BUILD_PATH, "root");
    const rootExecutablePath = path.join(rootPath, executablePath["darwin"]);
    const rootManifestPath = path.join(rootPath, manifestPath["darwin"]);

    // Create install locations
    fs.ensureDirSync(rootExecutablePath, { recursive: true });
    fs.ensureDirSync(rootManifestPath, { recursive: true });

    // Move files to root
    fs.moveSync(path.join(BUILD_PATH, executableName["darwin"])
          , path.join(rootExecutablePath, executableName["darwin"]));
    fs.moveSync(path.join(BUILD_PATH, manifestName)
          , path.join(rootManifestPath, manifestName));

    // Build component package
    spawnSync(
        `pkgbuild --root ${rootPath} `
               + `--identifier "tf.matt.fx_cast_bridge" `
               + `--version "0.0.1" `
               + `--scripts ${path.join(packagingDir, "scripts")} `
               + `${path.join(BUILD_PATH, componentName)}`
      , { shell: true });

    // Distribution XML file
    const distFilePath = path.join(packagingDir, "distribution.xml");

    // Build installer package
    spawnSync(
        `productbuild --distribution ${distFilePath} `
                   + `--package-path ${BUILD_PATH} `
                   + `${path.join(BUILD_PATH, installerName)}`
      , { shell: true });

    return installerName;

}

function packageLinuxDeb () {
    const installerName = "fx_cast_bridge.deb";

    // Create root
    const rootPath = path.join(BUILD_PATH, "root");
    const rootExecutablePath = path.join(rootPath, executablePath["linux"]);
    const rootManifestPath = path.join(rootPath, manifestPath["linux"]);

    fs.ensureDirSync(rootExecutablePath, { recursive: true });
    fs.ensureDirSync(rootManifestPath, { recursive: true });

    // Move files to root
    fs.moveSync(path.join(BUILD_PATH, executableName["linux"])
          , path.join(rootExecutablePath, executableName["linux"]));
    fs.moveSync(path.join(BUILD_PATH, manifestName)
          , path.join(rootManifestPath, manifestName));

    // Copy package info to root
    fs.copySync(path.join(__dirname, "../packaging/linux/deb/DEBIAN/")
          , path.join(rootPath, "DEBIAN"));

    // Build .deb package
    spawnSync(
        `dpkg-deb --build ${rootPath} `
                       + `${path.join(BUILD_PATH, installerName)}`
      , {  shell: true});

    return installerName;
}

function packageLinuxRpm () {
    const specPath = path.join(__dirname
          , "../packaging/linux/rpm/fx_cast_bridge.spec");

    spawnSync(
        `rpmbuild -bb ${specPath} `
               + `--define "_distdir ${BUILD_PATH}" `
               + `--define "_rpmdir ${BUILD_PATH}" `
      , { shell: true });

    return glob.sync("**/*.rpm", { cwd: BUILD_PATH })[0];
}

function packageWin32 () {}


build().catch(e => {
    console.log("Build failed", e);
    process.exit(1);
});
