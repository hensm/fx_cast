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

// Clean
fs.removeSync(path.join(__dirname, "../dist/ext/"));

const child = spawn(
    `webpack --env.extensionName=${extensionName} `
          + `--env.extensionId=${extensionId} `
          + `--env.extensionVersion=${extensionVersion} `
          + `--env.mirroringAppId=${argv.mirroringAppId} `
          + `--mode=${argv.mode} `
          + `${argv.watch ? "--watch" : ""} && `

  + `web-ext build --overwrite-dest `
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
