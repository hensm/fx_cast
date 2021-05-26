"use strict";

const fs = require("fs-extra");
const os = require("os");
const path = require("path");

const minimist = require("minimist");
const mustache = require("mustache");
const pkg = require("pkg");

const { spawnSync } = require("child_process");

const meta = require("../package.json");
const paths = require("./lib/paths");

const { author
      , homepage } = require("../../package.json");

      
const EXTENSION_ID = "fx_cast@matt.tf";


// Command line args
const argv = minimist(process.argv.slice(2), {
    boolean: [ "usePkg", "package", "skipNativeBuilds" ]
  , string: [ "arch", "packageType" ]
  , default: {
        arch: os.arch()
      , package: false
        // Linux package type (deb/rpm)
      , packageType: "deb"
      , skipNativeBuilds: false
    }
});


const supportedTargets = [
    "win-x64"
  , "win-x86"
  , "macos-x64"
  , "macos-arm64"
  , "linux-x64"
];

const supportedPlatforms = [];
const supportedArchs = [];

for (const target of supportedTargets) {
    const [ platform, arch ] = target.split("-");

    supportedPlatforms.push(platform);
    supportedArchs.push(arch);
}

if (!supportedPlatforms.includes(paths.pkgPlatformMap[process.platform])) {
    console.error("Unsupported target platform");
    process.exit(1);
}
if (!supportedArchs.includes(argv.arch)) {
    console.error("Unsupported target arch");
    process.exit(1);
}


const ROOT_PATH = path.join(__dirname, "..");
const SRC_PATH = path.join(ROOT_PATH, "src");
const BUILD_PATH = path.join(ROOT_PATH, "build");

const spawnOptions = {
    shell: true
  , stdio: [ process.stdin, process.stdout, process.stderr ]
};

/**
 * Shouldn't exist, but cleanup and re-create any existing
 * build directories, just in case.
 */
fs.removeSync(BUILD_PATH);
fs.removeSync(paths.DIST_PATH, { recursive: true });
fs.ensureDirSync(BUILD_PATH);
fs.ensureDirSync(paths.DIST_PATH, { recursive: true });


const MDNS_BINDING_PATH = path.join(
        __dirname, "../node_modules/mdns/build/Release/");
const MDNS_BINDING_NAME = "dns_sd_bindings.node";

async function build () {
    // Run tsc
    spawnSync(`tsc --project ${ROOT_PATH} \
                   --outDir ${BUILD_PATH}`
          , spawnOptions);

    /**
     * Native app manifest
     * https://mdn.io/Native_manifests#Native_messaging_manifests
     */
    const manifest = {
        "name": meta.__applicationName
      , "description": ""
      , "type": "stdio"
      , "allowed_extensions": [ EXTENSION_ID ]
    };

    /**
     * If packaging, add the installed executable path, otherwise
     * add the path to the built executable in the dist folder.
     */
    if (argv.package || argv.usePkg) {
        // Need a minimal package.json for pkg.
        const pkgManifest = {
            bin: "main.js"
          , pkg: {
                /**
                 * Workaround for pkg asset detection
                 * https://github.com/thibauts/node-castv2/issues/46
                 */
                "assets": "../../node_modules/castv2/lib/cast_channel.proto"
            }
        };

        const executableName = paths.getExecutableName(process.platform);
        const executablePath = paths.getExecutablePath(process.platform, argv.arch);

        // Write pkg manifest
        fs.writeFileSync(path.join(BUILD_PATH, "src/package.json")
              , JSON.stringify(pkgManifest))

        // Run pkg to create a single executable
        await pkg.exec([
            path.join(BUILD_PATH, "src")
          , "--target", `node12-${paths.pkgPlatformMap[process.platform]}-${argv.arch}`
          , "--output", path.join(BUILD_PATH, executableName)
        ]);

        fs.copySync(path.join(MDNS_BINDING_PATH, MDNS_BINDING_NAME)
              , path.join(BUILD_PATH, MDNS_BINDING_NAME));

        fs.removeSync(path.join(BUILD_PATH, "src"));

        manifest.path = !argv.package && argv.usePkg
            ? path.join(paths.DIST_PATH, executableName)
            : path.join(executablePath, executableName);
    } else {
        let launcherPath = path.join(BUILD_PATH
              , meta.__applicationExecutableName);
        const modulesDir = path.join(ROOT_PATH, "node_modules");

        switch (process.platform) {
            case "win32": {
                launcherPath += ".bat";
                fs.writeFileSync(launcherPath, 
`@echo off
setlocal
    set NODE_PATH=${modulesDir}
    node %~dp0src\\main.js --__name %~n0%~x0 %*
endlocal
`);
                break;
            }

            case "linux":
            case "darwin": {
                launcherPath += ".sh";
                fs.writeFileSync(launcherPath, 
`#!/usr/bin/env sh
NODE_PATH="${modulesDir}" node $(dirname $0)/src/main.js --__name $(basename $0) "$@"
`);
                break;
            }
        }

        manifest.path = path.join(paths.DIST_PATH, path.basename(launcherPath));
    }


    // Write app manifest
    fs.writeFileSync(path.join(BUILD_PATH, paths.MANIFEST_NAME)
          , JSON.stringify(manifest, null, 4));


    // Ensure file permissions are correct
    for (const file of fs.readdirSync(BUILD_PATH)) {
        fs.chmodSync(path.resolve(BUILD_PATH, file), 0o755);
    }

    /**
     * If packaging, create an installer package and move it to
     * dist, otherwise move the built executable and app manifest
     * to dist.
     */
    if (argv.package) {
        const installerName = await packageApp(process.platform, argv.arch);
        if (installerName) {
            // Move installer to dist
            fs.moveSync(
                    path.join(BUILD_PATH, installerName)
                  , path.join(paths.DIST_PATH, path.basename(installerName))
                  , { overwrite: true });
        }
    } else {
        // Move tsc output and launcher to dist
        fs.moveSync(BUILD_PATH, paths.DIST_PATH, { overwrite: true });
        /*
        spawnSync("npm install --production", {
            ...spawnOptions
          , cwd: paths.DIST_PATH
        });
        */
    }

    // Remove build directory
    fs.removeSync(BUILD_PATH);
}

/**
 * Takes a platform and returns the path of the created
 * installer package.
 */
async function packageApp (platform, arch) {
    const packageFunctionArgs = [
        arch
        // platformExecutableName
      , paths.getExecutableName(platform, arch)
        // platformExecutablePath
      , paths.getExecutablePath(platform, arch)
        // platformManifestPath
      , paths.getManifestPath(platform, arch, argv.packageType)
    ];

    switch (platform) {
        case "win32":  return packageWin32(...packageFunctionArgs);
        case "darwin": return packageDarwin(...packageFunctionArgs);

        case "linux": {
            switch (argv.packageType) {
                case "deb": return packageLinuxDeb(...packageFunctionArgs);
                case "rpm": return packageLinuxRpm(...packageFunctionArgs);
            }

            break;
        }


        default: {
            console.error("Unsupported target platform");
            process.exit(1);
        }
    }
}

/**
 * Builds a macOS Installer package.
 *
 * Creates a root directory with the installed file system
 * structure for package files, bundles the postinstall
 * script (packaging/mac/scripts/postinstall), then creates
 * a component package.
 * Distribution package is built from the component package
 * and distribution file (packaging/mac/distribution.xml).
 *
 * Requires the pkgbuild and productbuild command line
 * utilities. Only possible on macOS.
 */
function packageDarwin (
        arch
      , platformExecutableName
      , platformExecutablePath
      , platformManifestPath) {

    const outputName = `${meta.__applicationName}-${
                          meta.__applicationVersion}-${arch}.pkg`;
    const componentName = `${meta.__applicationName}_component.pkg`;

    const packagingDir = path.join(__dirname, "../packaging/mac/");
    const packagingOutputDir = path.join(BUILD_PATH, "packaging");

    // Create pkgbuild root
    const rootPath = path.join(BUILD_PATH, "root");
    const rootExecutablePath = path.join(rootPath, platformExecutablePath);
    const rootManifestPath = path.join(rootPath, platformManifestPath);

    // Create install locations
    fs.ensureDirSync(rootExecutablePath, { recursive: true });
    fs.ensureDirSync(rootManifestPath, { recursive: true });

    // Move files to root
    fs.moveSync(path.join(BUILD_PATH, platformExecutableName)
          , path.join(rootExecutablePath, platformExecutableName));
    fs.moveSync(path.join(BUILD_PATH, MDNS_BINDING_NAME)
          , path.join(rootExecutablePath, MDNS_BINDING_NAME));
    fs.moveSync(path.join(BUILD_PATH, paths.MANIFEST_NAME)
          , path.join(rootManifestPath, paths.MANIFEST_NAME));


    // Copy static files to be processed
    fs.copySync(packagingDir, packagingOutputDir);

    const view = {
        applicationName: meta.__applicationName
      , manifestName: paths.MANIFEST_NAME
      , componentName
      , packageId: `tf.matt.${meta.__applicationName}`
      , executablePath: platformExecutablePath
      , manifestPath: platformManifestPath
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
    spawnSync(`
        pkgbuild --root ${rootPath} \
                 --identifier "tf.matt.${meta.__applicationName}" \
                 --version "${meta.__applicationVersion}" \
                 --scripts ${path.join(packagingOutputDir, "scripts")} \
                 ${path.join(BUILD_PATH, componentName)}`
          , spawnOptions);

    // Distribution XML file
    const distFilePath = path.join(packagingOutputDir, "distribution.xml");

    // Build installer package
    spawnSync(`
        productbuild --distribution ${distFilePath} \
                     --package-path ${BUILD_PATH} \
                     ${path.join(BUILD_PATH, outputName)}`
          , spawnOptions);

    return outputName;
}

/**
 * Builds a DEB package for Debian, Ubuntu, Mint, etc...
 *
 * Creates a root directory with the installed file system
 * structure for package files, copies control file
 * (packaging/linux/deb/DEBIAN/control) to root, then builds
 * package from root.
 * Requires the dpkg-deb command line utility. 
 */
function packageLinuxDeb (
        arch
      , platformExecutableName
      , platformExecutablePath
      , platformManifestPath) {

    const outputName = `${meta.__applicationName}-${
                          meta.__applicationVersion}-${arch}.deb`;

    // Create root
    const rootPath = path.join(BUILD_PATH, "root");
    const rootExecutablePath = path.join(rootPath, platformExecutablePath);
    const rootManifestPath = path.join(rootPath, platformManifestPath);

    fs.ensureDirSync(rootExecutablePath, { recursive: true });
    fs.ensureDirSync(rootManifestPath, { recursive: true });

    // Move files to root
    fs.moveSync(path.join(BUILD_PATH, platformExecutableName)
          , path.join(rootExecutablePath, platformExecutableName));
    fs.moveSync(path.join(BUILD_PATH, MDNS_BINDING_NAME)
          , path.join(rootExecutablePath, MDNS_BINDING_NAME));
    fs.moveSync(path.join(BUILD_PATH, paths.MANIFEST_NAME)
          , path.join(rootManifestPath, paths.MANIFEST_NAME));

    const controlDir = path.join(__dirname, "../packaging/linux/deb/DEBIAN/");
    const controlOutputDir = path.join(rootPath, path.basename(controlDir));
    const controlFilePath = path.join(controlOutputDir, "control");

    // Copy package info to root
    fs.copySync(controlDir, controlOutputDir);

    const view = {
        // Debian package names can't contain underscores
        packageName: meta.__applicationName.replace(/_/g, "-")
      , applicationName: meta.__applicationName
      , applicationVersion: meta.__applicationVersion
      , author
    };

    // Do templating on control file
    fs.writeFileSync(controlFilePath
          , mustache.render(
                fs.readFileSync(controlFilePath).toString()
              , view));

    // Build .deb package
    spawnSync(`
        dpkg-deb --build ${rootPath} \
                         ${path.join(BUILD_PATH, outputName)}`
          , spawnOptions);

    return outputName;
}

/**
 * Builds an RPM package for Fedora, openSUSE, etc...
 *
 * Templates and uses the spec file
 * (packaging/linux/rpm/package.spec) to build the package.
 * Requires the rpmbuild command line utility.
 */
function packageLinuxRpm (
        arch
      , platformExecutableName
      , platformExecutablePath
      , platformManifestPath) {

    const outputName = `${meta.__applicationName}-${
                          meta.__applicationVersion}-${arch}.rpm`;

    const specPath = path.join(__dirname
          , "../packaging/linux/rpm/package.spec");

    const specOutputPath = path.join(BUILD_PATH, path.basename(specPath));

    const view = {
        packageName: meta.__applicationName
      , applicationName: meta.__applicationName
      , applicationVersion: meta.__applicationVersion
      , executablePath: platformExecutablePath
      , manifestPath: platformManifestPath
      , executableName: platformExecutableName
      , manifestName: paths.MANIFEST_NAME
      , bindingName: MDNS_BINDING_NAME
    };

    fs.writeFileSync(specOutputPath
          , mustache.render(
                fs.readFileSync(specPath).toString()
              , view));

    const rpmArchMap = {
        "x86": "i386"
      , "x64": "x86_64"
    };

    spawnSync(`
        rpmbuild -bb ${specOutputPath} \
                 --define "_distdir ${BUILD_PATH}" \
                 --define "_rpmdir ${BUILD_PATH}" \
                 --define "_rpmfilename ${outputName}" \
                 --target=${rpmArchMap[arch]}-linux`
          , spawnOptions);

    return outputName;
}

/**
 * Builds a Windows installer.
 *
 * Uses NSIS to create a GUI installer with an installer
 * script (packaging/win/installer.nsi). Requires the
 * makensis command line utility.
 */
function packageWin32 (
        arch
      , platformExecutableName
      , platformExecutablePath
      , platformManifestPath) {

    const outputName = `${meta.__applicationName}-${
                          meta.__applicationVersion}-${arch}.exe`;

    const scriptPath = path.join(__dirname, "../packaging/win/installer.nsi");
    const scriptOutputPath = path.join(BUILD_PATH, path.basename(scriptPath));

    const view = {
        applicationName: meta.__applicationName
      , applicationVersion: meta.__applicationVersion
      , executableName: platformExecutableName
      , executablePath: platformExecutablePath
      , manifestName: paths.MANIFEST_NAME
      , bindingName: MDNS_BINDING_NAME
      , winRegistryKey: paths.REGISTRY_KEY
      , outputName
      , licensePath: paths.LICENSE_PATH

        // Uninstaller keys
      , registryPublisher: author
      , registryUrlInfoAbout: homepage
    };

    // Write templated script to build dir
    fs.writeFileSync(scriptOutputPath
          , mustache.render(
                fs.readFileSync(scriptPath).toString()
              , view));

    spawnSync(`makensis /DARCH=${arch} ${scriptOutputPath}`
          , spawnOptions);

    return outputName;
}


build().catch(e => {
    console.log("Build failed", e);
    process.exit(1);
});
