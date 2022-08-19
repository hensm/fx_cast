// @ts-check

import fs from "fs-extra";
import os from "os";
import path from "path";
import url from "url";
import { spawnSync } from "child_process";

import mustache from "mustache";
import pkg from "pkg";
import yargs from "yargs";

import config from "../config.json" assert { type: "json" };
import * as paths from "./lib/paths.js";

const argv = await yargs()
    .help()
    .version(false)
    .option("package", {
        describe: "Create installer package",
        type: "boolean"
    })
    .option("package-type", {
        describe: "Linux package type",
        choices: ["deb", "rpm"],
        default: "deb"
    })
    .option("use-pkg", {
        describe: "Create single binary with pkg",
        type: "boolean"
    })
    .option("arch", {
        describe: "Set build architecture",
        default: os.arch()
    })
    .option("node-version", {
        describe: "Node.js version to target",
        default: "16"
    })
    .conflicts("use-pkg", "package")
    .parse(process.argv);

const supportedTargets = {
    win32: ["x86", "x64"],
    darwin: ["x64", "arm64"],
    linux: ["x64"]
};
if (!supportedTargets[process.platform]?.includes(argv.arch)) {
    console.error(
        `Error: Unsupported target! (${
            paths.pkgPlatformMap[process.platform]
        }-${argv.arch})`
    );

    process.exit(1);
}

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const ROOT_PATH = path.join(__dirname, "..");
const BUILD_PATH = path.join(ROOT_PATH, "build");

const spawnOptions = {
    shell: true,
    stdio: [process.stdin, process.stdout, process.stderr]
};

/**
 * Shouldn't exist, but cleanup and re-create any existing
 * build directories, just in case.
 */
fs.rmSync(BUILD_PATH, { force: true, recursive: true });
fs.rmSync(paths.DIST_PATH, { force: true, recursive: true });
fs.mkdirSync(BUILD_PATH, { recursive: true });
fs.mkdirSync(paths.DIST_PATH, { recursive: true });

const MDNS_BINDING_PATH = path.join(
    __dirname,
    "../node_modules/mdns/build/Release/"
);
const MDNS_BINDING_NAME = "dns_sd_bindings.node";

async function build() {
    // Run tsc
    spawnSync(
        `tsc --project ${ROOT_PATH} \
             --outDir ${BUILD_PATH}`,
        spawnOptions
    );

    /**
     * Native app manifest
     * https://mdn.io/Native_manifests#Native_messaging_manifests
     */
    const manifest = {
        name: config.applicationName,
        description: "",
        type: "stdio",
        allowed_extensions: [config.extensionId]
    };

    /**
     * If packaging, add the installed executable path, otherwise
     * add the path to the built executable in the dist folder.
     */
    if (argv.package || argv.usePkg) {
        // Need a minimal package.json for pkg.
        const pkgManifest = {
            bin: "main.js",
            pkg: {
                /**
                 * Workaround for pkg asset detection
                 * https://github.com/thibauts/node-castv2/issues/46
                 */
                assets: "../../node_modules/castv2/lib/cast_channel.proto"
            }
        };

        const executableName = paths.getExecutableName(process.platform);
        const executablePath = paths.getExecutableDirectory(
            process.platform,
            argv.arch
        );

        // Write pkg manifest
        fs.writeFileSync(
            path.join(BUILD_PATH, "src/package.json"),
            JSON.stringify(pkgManifest)
        );

        // Run pkg to create a single executable
        await pkg.exec([
            path.join(BUILD_PATH, "src"),
            "--target",
            `node${argv.nodeVersion}-${
                paths.pkgPlatformMap[process.platform]
            }-${argv.arch}`,
            "--output",
            path.join(BUILD_PATH, executableName)
        ]);

        fs.copySync(
            path.join(MDNS_BINDING_PATH, MDNS_BINDING_NAME),
            path.join(BUILD_PATH, MDNS_BINDING_NAME)
        );

        fs.rmSync(path.join(BUILD_PATH, "src"));

        manifest.path =
            !argv.package && argv.usePkg
                ? path.join(paths.DIST_PATH, executableName)
                : path.join(executablePath, executableName);
    } else {
        let launcherPath = path.join(
            BUILD_PATH,
            config.applicationExecutableName
        );
        const modulesDir = path.join(ROOT_PATH, "node_modules");

        // Write launcher script
        switch (process.platform) {
            case "win32": {
                launcherPath += ".bat";
                fs.writeFileSync(
                    launcherPath,
                    `@echo off
setlocal
    set NODE_PATH=${modulesDir}
    node %~dp0src\\main.js --__name %~n0%~x0 %*
endlocal
`
                );
                break;
            }

            case "linux":
            case "darwin": {
                launcherPath += ".sh";
                fs.writeFileSync(
                    launcherPath,
                    `#!/usr/bin/env sh
NODE_PATH="${modulesDir}" node $(dirname $0)/src/main.js --__name $(basename $0) "$@"
`
                );
                break;
            }
        }

        manifest.path = path.join(paths.DIST_PATH, path.basename(launcherPath));
    }

    // Write app manifest
    fs.writeFileSync(
        path.join(BUILD_PATH, paths.MANIFEST_NAME),
        JSON.stringify(manifest, null, 4)
    );

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
                path.join(BUILD_PATH, installerName),
                path.join(paths.DIST_PATH, path.basename(installerName)),
                { overwrite: true }
            );
        }
    } else {
        // Move tsc output and launcher to dist
        fs.moveSync(BUILD_PATH, paths.DIST_PATH, { overwrite: true });
    }

    // Remove build directory
    fs.rmSync(BUILD_PATH, { force: true, recursive: true });
}

/**
 * Takes a platform and returns the path of the created
 * installer package.
 *
 * @param {string} platform
 * @param {string} arch
 */
async function packageApp(platform, arch) {
    /** @type {[ string, string, string, string ]} */
    const packageFnArgs = [
        arch,
        paths.getExecutableName(platform),
        paths.getExecutableDirectory(platform, arch),
        paths.getManifestDirectory(platform, arch, argv.packageType)
    ];

    switch (platform) {
        case "win32":
            // Pass without manifest
            return packageWin32(
                packageFnArgs[0],
                packageFnArgs[1],
                packageFnArgs[2]
            );
        case "darwin":
            return packageDarwin(...packageFnArgs);

        case "linux": {
            switch (argv.packageType) {
                case "deb":
                    return packageLinuxDeb(...packageFnArgs);
                case "rpm":
                    return packageLinuxRpm(...packageFnArgs);
            }

            break;
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
 *
 * @param {string} arch
 * @param {string} platformExecutableName
 * @param {string} platformExecutableDirectory
 * @param {string} platformManifestDirectory
 */
function packageDarwin(
    arch,
    platformExecutableName,
    platformExecutableDirectory,
    platformManifestDirectory
) {
    const outputName = `${config.applicationName}-${config.applicationVersion}-${arch}.pkg`;
    const componentName = `${config.applicationName}_component.pkg`;

    const packagingDir = path.join(__dirname, "../packaging/mac/");
    const packagingOutputDir = path.join(BUILD_PATH, "packaging");

    // Create pkgbuild root
    const rootPath = path.join(BUILD_PATH, "root");
    const rootExecutableDirectory = path.join(
        rootPath,
        platformExecutableDirectory
    );
    const rootManifestDirectory = path.join(
        rootPath,
        platformManifestDirectory
    );

    // Create install locations
    fs.mkdirSync(rootExecutableDirectory, { recursive: true });
    fs.mkdirSync(rootManifestDirectory, { recursive: true });

    // Move files to root
    fs.moveSync(
        path.join(BUILD_PATH, platformExecutableName),
        path.join(rootExecutableDirectory, platformExecutableName)
    );
    fs.moveSync(
        path.join(BUILD_PATH, MDNS_BINDING_NAME),
        path.join(rootExecutableDirectory, MDNS_BINDING_NAME)
    );
    fs.moveSync(
        path.join(BUILD_PATH, paths.MANIFEST_NAME),
        path.join(rootManifestDirectory, paths.MANIFEST_NAME)
    );

    // Copy static files to be processed
    fs.copySync(packagingDir, packagingOutputDir);

    const view = {
        applicationName: config.applicationName,
        manifestName: paths.MANIFEST_NAME,
        componentName,
        packageId: `tf.matt.${config.applicationName}`,
        executablePath: platformExecutableDirectory,
        manifestPath: platformManifestDirectory
    };

    // Template paths
    const templatePaths = [
        path.join(packagingOutputDir, "scripts/postinstall"),
        path.join(packagingOutputDir, "distribution.xml")
    ];

    // Do templating on static files
    for (const templatePath of templatePaths) {
        const templateContent = fs.readFileSync(templatePath).toString();
        fs.writeFileSync(templatePath, mustache.render(templateContent, view));
    }

    // Build component package
    spawnSync(
        `pkgbuild --root ${rootPath} \
                  --identifier "tf.matt.${config.applicationName}" \
                  --version "${config.applicationVersion}" \
                  --scripts ${path.join(packagingOutputDir, "scripts")} \
                  ${path.join(BUILD_PATH, componentName)}`,
        spawnOptions
    );

    // Distribution XML file
    const distFilePath = path.join(packagingOutputDir, "distribution.xml");

    // Build installer package
    spawnSync(
        `productbuild --distribution ${distFilePath} \
                      --package-path ${BUILD_PATH} \
                      ${path.join(BUILD_PATH, outputName)}`,
        spawnOptions
    );

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
 *
 * @param {string} arch
 * @param {string} platformExecutableName
 * @param {string} platformExecutableDirectory
 * @param {string} platformManifestDirectory
 */
function packageLinuxDeb(
    arch,
    platformExecutableName,
    platformExecutableDirectory,
    platformManifestDirectory
) {
    const outputName = `${config.applicationName}-${config.applicationVersion}-${arch}.deb`;

    // Create root
    const rootPath = path.join(BUILD_PATH, "root");
    const rootExecutableDirectory = path.join(
        rootPath,
        platformExecutableDirectory
    );
    const rootManifestDirectory = path.join(
        rootPath,
        platformManifestDirectory
    );

    fs.mkdirSync(rootExecutableDirectory, { recursive: true });
    fs.mkdirSync(rootManifestDirectory, { recursive: true });

    // Move files to root
    fs.moveSync(
        path.join(BUILD_PATH, platformExecutableName),
        path.join(rootExecutableDirectory, platformExecutableName)
    );
    fs.moveSync(
        path.join(BUILD_PATH, MDNS_BINDING_NAME),
        path.join(rootExecutableDirectory, MDNS_BINDING_NAME)
    );
    fs.moveSync(
        path.join(BUILD_PATH, paths.MANIFEST_NAME),
        path.join(rootManifestDirectory, paths.MANIFEST_NAME)
    );

    const controlDir = path.join(__dirname, "../packaging/linux/deb/DEBIAN/");
    const controlOutputDir = path.join(rootPath, path.basename(controlDir));
    const controlFilePath = path.join(controlOutputDir, "control");

    // Copy package info to root
    fs.copySync(controlDir, controlOutputDir);

    const view = {
        // Debian package names can't contain underscores
        packageName: config.applicationName.replace(/_/g, "-"),
        applicationName: config.applicationName,
        applicationVersion: config.applicationVersion,
        author: config.author
    };

    // Do templating on control file
    fs.writeFileSync(
        controlFilePath,
        mustache.render(fs.readFileSync(controlFilePath).toString(), view)
    );

    // Build .deb package
    spawnSync(
        `dpkg-deb --build ${rootPath} \
                          ${path.join(BUILD_PATH, outputName)}`,
        spawnOptions
    );

    return outputName;
}

/**
 * Builds an RPM package for Fedora, openSUSE, etc...
 *
 * Templates and uses the spec file
 * (packaging/linux/rpm/package.spec) to build the package.
 * Requires the rpmbuild command line utility.
 *
 * @param {string} arch
 * @param {string} platformExecutableName
 * @param {string} platformExecutableDirectory
 * @param {string} platformManifestDirectory
 */
function packageLinuxRpm(
    arch,
    platformExecutableName,
    platformExecutableDirectory,
    platformManifestDirectory
) {
    const outputName = `${config.applicationName}-${config.applicationVersion}-${arch}.rpm`;

    const specPath = path.join(
        __dirname,
        "../packaging/linux/rpm/package.spec"
    );

    const specOutputPath = path.join(BUILD_PATH, path.basename(specPath));

    const view = {
        packageName: config.applicationName,
        applicationName: config.applicationName,
        applicationVersion: config.applicationVersion,
        executablePath: platformExecutableDirectory,
        manifestPath: platformManifestDirectory,
        executableName: platformExecutableName,
        manifestName: paths.MANIFEST_NAME,
        bindingName: MDNS_BINDING_NAME
    };

    fs.writeFileSync(
        specOutputPath,
        mustache.render(fs.readFileSync(specPath).toString(), view)
    );

    const rpmArchMap = { x86: "i386", x64: "x86_64" };

    spawnSync(
        `rpmbuild -bb ${specOutputPath} \
                  --define "_distdir ${BUILD_PATH}" \
                  --define "_rpmdir ${BUILD_PATH}" \
                  --define "_rpmfilename ${outputName}" \
                  --target=${rpmArchMap[arch]}-linux`,
        spawnOptions
    );

    return outputName;
}

/**
 * Builds a Windows installer.
 *
 * Uses NSIS to create a GUI installer with an installer
 * script (packaging/win/installer.nsi). Requires the
 * makensis command line utility.
 *
 * @param {string} arch
 * @param {string} platformExecutableName
 * @param {string} platformExecutableDirectory
 */
function packageWin32(
    arch,
    platformExecutableName,
    platformExecutableDirectory
) {
    const outputName = `${config.applicationName}-${config.applicationVersion}-${arch}.exe`;

    const scriptPath = path.join(__dirname, "../packaging/win/installer.nsi");
    const scriptOutputPath = path.join(BUILD_PATH, path.basename(scriptPath));

    const view = {
        applicationName: config.applicationName,
        applicationVersion: config.applicationVersion,
        executableName: platformExecutableName,
        executablePath: platformExecutableDirectory,
        manifestName: paths.MANIFEST_NAME,
        bindingName: MDNS_BINDING_NAME,
        winRegistryKey: paths.REGISTRY_KEY,
        outputName,
        licensePath: paths.LICENSE_PATH,

        // Uninstaller keys
        registryPublisher: config.author,
        registryUrlInfoAbout: config.homepageUrl
    };

    // Write templated script to build dir
    fs.writeFileSync(
        scriptOutputPath,
        mustache.render(fs.readFileSync(scriptPath).toString(), view)
    );

    spawnSync(`makensis /DARCH=${arch} ${scriptOutputPath}`, spawnOptions);

    return outputName;
}

build().catch(e => {
    console.error("Error: Build failed!", e);
    process.exit(1);
});
