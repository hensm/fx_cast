const fs = require("fs-extra");
const path = require("path");
const minimist = require("minimist");
const webpack = require("webpack");
const webExt = require("web-ext").default;


const DIST_PATH = path.join(__dirname, "../dist/ext");
const UNPACKED_PATH = path.join(DIST_PATH, "unpacked");


const argv = minimist(process.argv.slice(2), {
    boolean: [ "package", "watch" ]
  , string: [ "mirroringAppId", "mode" ]
  , default: {
        package: false             // Should package with web-ext
      , watch: false               // Should run webpack in watch mode
      , mirroringAppId: "19A6F4AE" // Chromecast mirroring receiver app ID
      , mode: "development"        // webpack mode
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
const webpackConfig = require("./webpack.config.js")({
    /**
     * If watching files, output directly to dist. Unpacked
     * directory is used as a staging area for web-ext builds.
     */
    outputPath: argv.package
        ? UNPACKED_PATH
        : DIST_PATH

  , extensionName: "fx_cast"
  , extensionId: "fx_cast@matt.tf"
  , extensionVersion: "0.0.1"
  , mirroringAppId: argv.mirroringAppId
});

// Add mode to config
webpackConfig.mode = argv.mode;


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

            }).then(() => {
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
