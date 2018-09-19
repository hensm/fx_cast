const spawn = require('child_process').spawn;
const argv = require('minimist')(process.argv.slice(2));

const appId = argv.appId || "19A6F4AE";

const child = spawn(
    `webpack --env.appId=${appId} `
        + '&& web-ext build '
            + '--overwrite-dest '
            + '--source-dir '
            + '../dist/ext/unpacked '
            + '--artifacts-dir '
            + '../dist/ext '
        + '&& mv ../dist/ext/*.zip ../dist/ext/ext.xpi'
  , {
        shell: true
    }
);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
