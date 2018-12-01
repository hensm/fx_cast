const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");
const minimist = require("minimist");


const argv = minimist(process.argv.slice(2), {
    boolean: [ "package", "watch" ]
  , string: [ "mirroringAppId", "mode" ]
  , default: {
        package: false
      , watch: false
      , mirroringAppId: "19A6F4AE"
      , mode: "development"
    }
});

if (argv.package) {
    argv.mode = "production";
    argv.watch = false;
}


const extensionName = "fx_cast";
const extensionId = "fx_cast@matt.tf";
const extensionVersion = "0.0.1";

const DIST_PATH = path.join(__dirname, "../dist/ext");
const UNPACKED_PATH = path.join(DIST_PATH, "unpacked");

// Clean
fs.removeSync(DIST_PATH);

const buildCmd = `web-ext build --overwrite-dest `
                             + `--source-dir ${UNPACKED_PATH} `
                             + `--artifacts-dir ${DIST_PATH} `;

const child = spawn(
    `webpack --env.extensionName=${extensionName} `
          + `--env.extensionId=${extensionId} `
          + `--env.extensionVersion=${extensionVersion} `
          + `--env.mirroringAppId=${argv.mirroringAppId} `
          + `--mode=${argv.mode} `
          + `${argv.watch ? "--watch" : ""} `
    + `${argv.package ? "&&" + buildCmd : ""} `
  , { shell: true }
);

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on("exit", () => {
    if (argv.package) {
        fs.remove(UNPACKED_PATH);   
    } else {
        for (const file of fs.readdirSync(UNPACKED_PATH)) {
            fs.moveSync(path.join(UNPACKED_PATH, file)
                  , path.join(DIST_PATH, file)
                  , { overwrite: true });
        }

        // Remove empty unpacked directory
        fs.remove(UNPACKED_PATH);
    }
});
