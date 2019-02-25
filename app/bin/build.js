const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const minimist = require("minimist");
const glob = require("glob");
const mustache = require("mustache");

const { spawnSync } = require("child_process");
const { exec: pkgExec } = require("pkg");

const { __applicationName: applicationName
      , __applicationVersion: applicationVersion } = require("../package.json");

const { __extensionId: extensionId } = require("../../ext/package.json");

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

const ROOT_PATH = path.join(__dirname, "..");
const SRC_PATH = path.join(ROOT_PATH, "src");
const BUILD_PATH = path.join(ROOT_PATH, "build");


// Clean
fs.removeSync(BUILD_PATH);
fs.removeSync(DIST_PATH);

// Make directories
fs.ensureDirSync(BUILD_PATH);
fs.ensureDirSync(DIST_PATH, { recursive: true });


async function build () {
    // Run tsc
    spawnSync(`tsc --project ${ROOT_PATH} \
                   --outDir ${BUILD_PATH}`
      , {
          shell: true
        , stdio: [ process.stdin, process.stdout, process.stderr ]
      });

    // Move tsc output to build dir
    fs.moveSync(path.join(BUILD_PATH, "src"), BUILD_PATH);

    // Copy other files
    fs.copySync(SRC_PATH, BUILD_PATH, {
        overwrite: true
      , filter (src, dest) {
            return !/.(js|ts)$/.test(src);
        }
    });


    // Create app manifest
    const manifest = {
        "name": applicationName
      , "description": ""
      , "type": "stdio"
      , "allowed_extensions": [ extensionId ]
      , "path": argv.package
            // Add either installed path or dist path
            ? path.join(executablePath[argv.platform]
                      , executableName[argv.platform])
            : path.join(DIST_PATH, executableName[argv.platform])
    };

    // Write manifest
    fs.writeFileSync(path.join(BUILD_PATH, manifestName)
          , JSON.stringify(manifest, null, 4));


    // File permissions
    for (const file of fs.readdirSync(BUILD_PATH)) {
        fs.chmodSync(path.resolve(BUILD_PATH, file), 0o755);
    }


    const pkgManifest = {
        bin: "main.js"
      , pkg: {
            // Workaround for pkg asset detection
            // https://github.com/thibauts/node-castv2/issues/46
            "assets": "../node_modules/castv2/lib/cast_channel.proto"
        }
    };

    fs.writeFileSync(path.join(BUILD_PATH, "package.json")
          , JSON.stringify(pkgManifest))

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
            return packageDarwin(platform);

        case "linux":
            switch (argv.packageType) {
                case "deb":
                    return packageLinuxDeb(platform, argv.packageType);
                case "rpm":
                    return packageLinuxRpm(platform, argv.packageType);
            }

        case "win32":
            return packageWin32();

        default:
            console.log("Cannot build installer package for this platform");
    }
}

function packageDarwin (platform) {
    const installerName = `${applicationName}.pkg`;
    const componentName = `${applicationName}_component.pkg`;

    const packagingDir = path.join(__dirname, "../packaging/mac/");
    const packagingOutputDir = path.join(BUILD_PATH, "packaging");

    // Create pkgbuild root
    const rootPath = path.join(BUILD_PATH, "root");
    const rootExecutablePath = path.join(rootPath, executablePath[platform]);
    const rootManifestPath = path.join(rootPath, manifestPath[platform]);

    // Create install locations
    fs.ensureDirSync(rootExecutablePath, { recursive: true });
    fs.ensureDirSync(rootManifestPath, { recursive: true });

    // Move files to root
    fs.moveSync(path.join(BUILD_PATH, executableName[platform])
          , path.join(rootExecutablePath, executableName[platform]));
    fs.moveSync(path.join(BUILD_PATH, manifestName)
          , path.join(rootManifestPath, manifestName));


    // Copy static files to be processed
    fs.copySync(packagingDir, packagingOutputDir);

    const view = {
        applicationName
      , manifestName
      , componentName
      , packageId: `tf.matt.${applicationName}`
      , executablePath: executablePath[platform]
      , manifestPath: manifestPath[platform]
    };

    // Template paths
    const templatePaths = [
        path.join(packagingOutputDir, "scripts/postinstall")
      , path.join(packagingOutputDir, "distribution.xml")
    ];

    // Do templating on static files
    for (const templatePath of templatePaths) {
        const templateContent = fs.readFileSync(templatePath).toString();
        fs.writeFileSync(templatePath, mustache.render(templateContent, view));
    }


    // Build component package
    spawnSync(
        `pkgbuild --root ${rootPath} `
               + `--identifier "tf.matt.${applicationName}" `
               + `--version "${applicationVersion}" `
               + `--scripts ${path.join(packagingOutputDir, "scripts")} `
               + `${path.join(BUILD_PATH, componentName)}`
      , { shell: true });

    // Distribution XML file
    const distFilePath = path.join(packagingOutputDir, "distribution.xml");

    // Build installer package
    spawnSync(
        `productbuild --distribution ${distFilePath} `
                   + `--package-path ${BUILD_PATH} `
                   + `${path.join(BUILD_PATH, installerName)}`
      , { shell: true });

    return installerName;

}

function packageLinuxDeb (platform, packageType) {
    const installerName = `${applicationName}.deb`;

    // Create root
    const rootPath = path.join(BUILD_PATH, "root");
    const rootExecutablePath = path.join(rootPath, executablePath[platform]);
    const rootManifestPath = path.join(rootPath
          , manifestPath[platform][packageType]);

    fs.ensureDirSync(rootExecutablePath, { recursive: true });
    fs.ensureDirSync(rootManifestPath, { recursive: true });

    // Move files to root
    fs.moveSync(path.join(BUILD_PATH, executableName[platform])
          , path.join(rootExecutablePath, executableName[platform]));
    fs.moveSync(path.join(BUILD_PATH, manifestName)
          , path.join(rootManifestPath, manifestName));


    const controlDir = path.join(__dirname, "../packaging/linux/deb/DEBIAN/");
    const controlOutputDir = path.join(rootPath, path.basename(controlDir));
    const controlFilePath = path.join(controlOutputDir, "control");

    // Copy package info to root
    fs.copySync(controlDir, controlOutputDir);

    const view = {
        // Debian package names can't contain underscores
        packageName: applicationName.replace(/_/g, "-")
      , applicationName
      , applicationVersion
    };

    // Do templating on control file
    fs.writeFileSync(controlFilePath
          , mustache.render(
                fs.readFileSync(controlFilePath).toString()
              , view));

    // Build .deb package
    spawnSync(
        `dpkg-deb --build ${rootPath} `
                       + `${path.join(BUILD_PATH, installerName)}`
      , {  shell: true});

    return installerName;
}

function packageLinuxRpm (platform, packageType) {
    const specPath = path.join(__dirname
          , "../packaging/linux/rpm/package.spec");

    const specOutputPath = path.join(BUILD_PATH, path.basename(specPath));

    const view = {
        packageName: applicationName
      , applicationName
      , applicationVersion
      , executablePath: executablePath[platform]
      , manifestPath: manifestPath[platform][packageType]
      , executableName: executableName[platform]
      , manifestName
    };

    fs.writeFileSync(specOutputPath
          , mustache.render(
                fs.readFileSync(specPath).toString()
              , view));

    spawnSync(
        `rpmbuild -bb ${specOutputPath} `
               + `--define "_distdir ${BUILD_PATH}" `
               + `--define "_rpmdir ${BUILD_PATH}" `
               + `--target=x86_64-linux`
      , { shell: true });

    return glob.sync("**/*.rpm", { cwd: BUILD_PATH })[0];
}

function packageWin32 () {}


build().catch(e => {
    console.log("Build failed", e);
    process.exit(1);
});
