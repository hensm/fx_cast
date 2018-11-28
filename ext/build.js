const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");
const argv = require("minimist")(process.argv.slice(2));


const extensionName = "fx_cast";
const extensionId = "fx_cast@matt.tf";
const extensionVersion = "0.0.1";


if (argv.package) {
    argv.mode = "production";
    argv.watch = false;
}

// Default argument values
const { mirroringAppId = "19A6F4AE"
      , mode = "development" } = argv;

// Clean
fs.removeSync(path.join(__dirname, "../dist/ext/"));

const child = spawn(
    `webpack --env.extensionName=${extensionName} `
          + `--env.extensionId=${extensionId} `
          + `--env.extensionVersion=${extensionVersion} `
          + `--env.mirroringAppId=${mirroringAppId} `
          + `--mode=${mode} `
          + `${argv.watch ? "--watch" : ""} `
        + `&& web-ext build --overwrite-dest `
                         + `--source-dir ../dist/ext/unpacked `
                         + `--artifacts-dir ../dist/ext `
  , { shell: true }
);

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on("exit", () => {
    if (argv.package) {
        fs.remove(path.join(__dirname, "../dist/ext/unpacked"));   
    }
});
