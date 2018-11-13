const fs = require('fs');
const os = require('os');
const path = require('path');

require('@babel/register');

const argv = require('minimist')(process.argv.slice(2));
const rollup = require('rollup');

const config = require('../rollup/rollup.config').default;

const MANIFEST_NAME = 'fx_cast_bridge.json';

async function build() {
    const {path: executablePath, platform, ...configOptions} = argv;

    const {output: bundleOutputs, ...bundleOptions} = config(configOptions);
    const bundle = await rollup.rollup(bundleOptions);

    for (const output of bundleOutputs) {
        await bundle.write(output);
        fs.chmodSync(output.file, '755');
    }

    const targetPlatform = platform || os.type();
    const launcherExt = targetPlatform.toLowerCase().startsWith('win')
            ? 'bat'
            : 'sh';
    const launcherName = `launcher.${launcherExt}`;
    const launcherPath = path.join(__dirname, '../../dist/app', launcherName);

    fs.copyFileSync(path.join(`src`, launcherName), launcherPath);

    const manifest = {
        ...(JSON.parse(fs.readFileSync(`src/${MANIFEST_NAME}`, 'utf8')))
      , path: (executablePath || path.resolve(launcherPath))
    };

    fs.writeFileSync(
        path.join('../dist/app', MANIFEST_NAME)
      , JSON.stringify(manifest, null, 4)
    );
}

build().catch(e => {
    console.log("Build failed", e);
    process.exit(1);
});
