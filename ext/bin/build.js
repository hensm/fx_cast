"use strict";

const esbuild = require("esbuild");
const fs = require("fs-extra");
const path = require("path");
const minimist = require("minimist");
const webExt = require("web-ext");

const BRIDGE_NAME = "fx_cast_bridge";
const BRIDGE_VERSION = "0.1.0";

const MIRRORING_APP_ID = "19A6F4AE";

const argv = minimist(process.argv.slice(2), {
    boolean: ["package", "watch"],
    string: ["mirroringAppId", "mode"],
    default: {
        package: false,
        watch: false,
        mirroringAppId: MIRRORING_APP_ID,
        mode: "development"
    }
});

if (argv.package && argv.watch) {
    console.error("Cannot package whilst watching files.");
    process.exit(1);
}

// If packaging, use production mode
if (argv.package) {
    argv.mode = "production";
}

// Paths
const rootPath = path.resolve(__dirname, "../");
const srcPath = path.join(rootPath, "src");

const distPath = path.join(rootPath, "../dist/ext/");
const unpackedPath = path.join(distPath, "unpacked");

const outPath = argv.package ? unpackedPath : distPath;

/** @type esbuild.Plugin */
const preactCompatPlugin = {
    /**
     * Handle react/react-dom preact compat modules.
     */
    name: "preact-compat",
    setup(build) {
        const preactPath = path.resolve(
            __dirname,
            "../node_modules/preact/compat/dist/compat.module.js"
        );

        build.onResolve({ filter: /^(react|react-dom)$/ }, args => ({
            path: preactPath
        }));
    }
};

/** @type esbuild.BuildOptions */
const buildOpts = {
    bundle: true,
    target: "firefox64",
    logLevel: "info",
    sourcemap: "inline",

    outdir: outPath,
    outbase: srcPath,

    entryPoints: [
        // Main
        `${srcPath}/background/background.ts`,
        // Cast
        `${srcPath}/cast/index.ts`,
        `${srcPath}/cast/content.ts`,
        `${srcPath}/cast/contentBridge.ts`,
        // Media sender
        `${srcPath}/cast/senders/media/index.ts`,
        // Mirroring sender
        `${srcPath}/cast/senders/mirroring.ts`,
        // UI
        `${srcPath}/ui/popup/index.tsx`,
        `${srcPath}/ui/options/index.tsx`
    ],
    define: {
        BRIDGE_NAME: `"${BRIDGE_NAME}"`,
        BRIDGE_VERSION: `"${BRIDGE_VERSION}"`,
        MIRRORING_APP_ID: `"${argv.mirroringAppId}"`
    },
    plugins: [preactCompatPlugin]
};

// Set production options
if (argv.mode === "production") {
    buildOpts.minify = true;
    buildOpts.sourcemap = false;
}

/**
 * Handle build results.
 *
 * @param {esbuild.BuildResult} result
 */
function onBuildResult(result) {
    if (result.errors.length) {
        console.error("Build error!");
        return;
    }

    const manifest = JSON.parse(
        fs.readFileSync(`${srcPath}/manifest.json`, { encoding: "utf-8" })
    );

    manifest.content_security_policy =
        argv.mode === "production"
            ? "script-src 'self'; object-src 'self'"
            : "script-src 'self' 'unsafe-eval'; object-src 'self'";

    fs.writeFileSync(`${outPath}/manifest.json`, JSON.stringify(manifest));

    copy(srcPath, outPath, /^(manifest\.json|.*\.(ts|tsx|js|jsx))$/);
}

/**
 * Recursively copy directory contents.
 *
 * @param {string} src Source path
 * @param {string} dest Destination path
 * @param {RegExp} excludeRegex Match for file exclusion
 */
function copy(src, dest, excludeRegex) {
    if (!fs.existsSync(src)) return;

    const stats = fs.statSync(src);
    if (!stats.isDirectory()) {
        const dirName = path.dirname(dest);
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        }
        fs.copyFileSync(src, dest);
        return;
    }

    for (const file of fs.readdirSync(src)) {
        if (excludeRegex.test(file)) continue;
        copy(path.join(src, file), path.join(dest, file), excludeRegex);
    }
}

// Clean
fs.removeSync(distPath);

if (argv.watch) {
    esbuild
        .build({
            ...buildOpts,
            watch: {
                onRebuild(_err, result) {
                    return onBuildResult(result);
                }
            }
        })
        .then(onBuildResult);
} else {
    esbuild.build(buildOpts).then(result => {
        onBuildResult(result);

        if (argv.package) {
            webExt.cmd
                .build(
                    {
                        /**
                         * Webpack output at sourceDir is built into an extension
                         * archive at artifactsDir.
                         */
                        sourceDir: unpackedPath,
                        artifactsDir: distPath,
                        overwriteDest: true
                    },
                    {
                        // Prevent auto-exit
                        shouldExitProgram: false
                    }
                )
                .then(result => {
                    const outputName = path.basename(result.extensionPath);

                    // Rename output extension to XPI
                    fs.moveSync(
                        path.join(distPath, outputName),
                        path.join(distPath, outputName.replace("zip", "xpi"))
                    );

                    // Only need the built extension archive
                    fs.remove(unpackedPath);
                });
        }
    });
}
