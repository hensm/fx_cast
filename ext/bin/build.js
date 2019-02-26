"use strict";

const fs = require("fs-extra");
const path = require("path");
const minimist = require("minimist");
const webpack = require("webpack");
const webExt = require("web-ext").default;

const { ROOT
      , INCLUDE_PATH
      , DIST_PATH
      , UNPACKED_PATH } = require("./lib/paths");

const packageMeta = require(`${ROOT}/package.json`);
const appPackageMeta = require(`${ROOT}/../app/package.json`);


const argv = minimist(process.argv.slice(2), {
    boolean: [ "package", "watch" ]
  , string: [ "mirroringAppId", "mode" ]
  , default: {
        package: false                           // Should package with web-ext
      , watch: false                             // Should run webpack in watch mode
      , mirroringAppId: packageMeta.__mirroringAppId // Chromecast receiver app ID
      , mode: "development"                      // webpack mode
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


// Import webpack config and specify env values
const webpackConfig = require(`${ROOT}/webpack.config.js`)({
    includePath: INCLUDE_PATH
    /**
     * If watching files, output directly to dist. Unpacked
     * directory is used as a staging area for web-ext builds.
     */
  , outputPath: argv.package
        ? UNPACKED_PATH
        : DIST_PATH

  , extensionName: packageMeta.__extensionName
  , extensionId: packageMeta.__extensionId
  , extensionVersion: packageMeta.__extensionVersion
  , applicationName: appPackageMeta.__applicationName
  , applicationVersion: appPackageMeta.__applicationVersion
  , mirroringAppId: argv.mirroringAppId

    // eval source map needs special CSP
  , contentSecurityPolicy: argv.mode === "production"
        ? "default-src 'self'"
        : "script-src 'self' 'unsafe-eval'; object-src 'self'"
});

// Add mode to config
webpackConfig.mode = argv.mode;
webpackConfig.devtool = argv.mode === "production"
    ? "source-map"
    : "eval";


// Clean
fs.removeSync(DIST_PATH);


// Create webpack compiler instance
const compiler = webpack(webpackConfig);

if (argv.watch) {
    // Start webpack watch
    compiler.watch({}, handleCompilerOutput);
} else {
    compiler.run((...args) => {
        handleCompilerOutput(...args);

        if (argv.package) {
            webExt.cmd.build({
                /**
                 * Webpack output at sourceDir is built into an extension
                 * archive at artifactsDir.
                 */
                sourceDir: UNPACKED_PATH
              , artifactsDir: DIST_PATH
              , overwriteDest: true
            }, {
                // Prevent auto-exit
                shouldExitProgram: false

            }).then(result => {
                const archiveName = path.basename(result.extensionPath);

                fs.moveSync(path.join(DIST_PATH, archiveName)
                      , path.join(DIST_PATH, archiveName.replace("zip", "xpi")));

                // Only need the built extension archive
                fs.remove(UNPACKED_PATH);
            })
        }
    });
}

/**
 * Log errors and output formatted compilation info.
 */
function handleCompilerOutput (err, stats) {
    // If there are fatal errors, log and exit
    if (err) {
        console.error(err.stack || err);
        if (err.details) {
            console.error(err.details);
        }

        return;
    }

    // Get compilation info
    const info = stats.toJson();

    // Log errors/warnings
    if (stats.hasErrors()) console.error(info.errors);
    if (stats.hasWarnings()) console.warn(info.warnings);

    // Log formatted output
    console.log(stats.toString());
}
