// @ts-check

import fs from "fs-extra";
import path from "path";
import url from "url";

import esbuild from "esbuild";
import sveltePlugin from "esbuild-svelte";
import sveltePreprocess from "svelte-preprocess";
import yargs from "yargs";
import webExt from "web-ext";

import copyFilesPlugin from "./lib/copyFilesPlugin.js";

const BRIDGE_NAME = "fx_cast_bridge";
const BRIDGE_VERSION = "0.2.0";

const MIRRORING_APP_ID = "19A6F4AE";

const argv = yargs()
    .help()
    .version(false)
    .option("watch", {
        describe: "Rebuild on changes",
        type: "boolean"
    })
    .option("package", {
        describe: "Package with web-ext",
        type: "boolean",
        conflicts: "watch"
    })
    .option("mode", {
        describe: "Set build mode",
        choices: ["development", "production"],
        default: "development"
    })
    .parseSync(process.argv);

// If packaging, use production mode
if (argv.package) {
    argv.mode = "production";
}

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Paths
const rootPath = path.join(__dirname, "../");
const srcPath = path.join(rootPath, "src");

const distPath = path.join(rootPath, "../dist/ext/");
const unpackedPath = path.join(distPath, "unpacked");

const outPath = argv.package ? unpackedPath : distPath;

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
        path.join(srcPath, "background/background.ts"),
        // Cast
        path.join(srcPath, "cast/index.ts"),
        path.join(srcPath, "cast/content.ts"),
        path.join(srcPath, "cast/contentBridge.ts"),
        // Media sender
        path.join(srcPath, "cast/senders/media/index.ts"),
        // Mirroring sender
        path.join(srcPath, "/cast/senders/mirroring.ts"),
        // UI
        path.join(srcPath, "ui/popup/index.ts"),
        path.join(srcPath, "ui/options/index.ts")
    ],
    define: {
        BRIDGE_NAME: `"${BRIDGE_NAME}"`,
        BRIDGE_VERSION: `"${BRIDGE_VERSION}"`,
        MIRRORING_APP_ID: `"${MIRRORING_APP_ID}"`
    },
    plugins: [
        // @ts-ignore
        sveltePlugin({
            // @ts-ignore
            preprocess: sveltePreprocess()
        }),

        // Copy static files
        copyFilesPlugin({
            src: srcPath,
            dest: outPath,
            excludePattern: /^(manifest\.json|.*\.(ts|js|svelte))$/
        })
    ]
};

// Set production options
if (argv.mode === "production") {
    buildOpts.minify = true;
    buildOpts.sourcemap = false;
}

/**
 * Handle build results.
 *
 * @param {esbuild.BuildResult | null} result
 */
function onBuildResult(result) {
    if (result?.errors.length) {
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
