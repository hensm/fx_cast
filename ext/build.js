const { spawn } = require('child_process');
const argv = require('minimist')(process.argv.slice(2));


const extensionName = "fx_cast";
const extensionId = "fx_cast@matt.tf";
const extensionVersion = "0.0.1";

// Default argument values
const { mirroringAppId = "19A6F4AE"
      , mode = "development" } = argv;

const child = spawn(
    `webpack --env.extensionName=${extensionName} `
          + `--env.extensionId=${extensionId} `
          + `--env.extensionVersion=${extensionVersion} `
          + `--env.mirroringAppId=${mirroringAppId} `
          + `--mode=${mode} `
          + `${argv.watch ? "--watch" : ""} `
        + `&& web-ext build --overwrite-dest `
                         + `--source-dir ../dist/ext `
                         + `--artifacts-dir ../dist/ext `
  , {
        shell: true
    }
);

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
