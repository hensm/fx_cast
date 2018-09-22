const fs = require('fs');
const os = require('os');
const path = require('path');

const argv = require('minimist')(process.argv.slice(2));
const mkdirpSync = require('mkdirp').sync;

const MANIFEST_NAME = 'fx_cast_bridge.json';
const MANIFEST_PATH = path.resolve(__dirname, '../../dist/app', MANIFEST_NAME);

const WIN_REGISTRY_KEY = 'fx_cast_bridge';

let destination = argv.destination;

switch (os.type()) {
    case 'Darwin': {
        if (!destination) {
            const root = argv.root || process.env.HOME;
            destination = path.resolve(
                path.join(
                    root
                  , 'Library/Application Support/Mozilla/NativeMessagingHosts'
                )
            );
        }

        break;
    }

    case 'Linux': {
        if (!destination) {
            const root = argv.root || `${process.env.HOME}/.`;
            destination = root.endsWith('/.')
                ? `${root}mozilla/native-messaging-hosts/`
                : path.join(root, 'mozilla/native-messaging-hosts/');
        }

        break;
    }

    case 'Windows_NT': {
        const regedit = require('regedit');
        const destinationManifestPath = path.join(destination, MANIFEST_NAME)
            || MANIFEST_PATH;

        regedit.putValue({
            'HKEY_CURRENT_USER\\SOFTWARE\\Mozilla\\NativeMessagingHosts': {
                [WIN_REGISTRY_KEY]: {
                    value: destinationManifestPath
                  , type: 'REG_DEFAULT'
                }
            }
        });

        break;
    }

    default:
        console.error('Sorry, this installer does not yet support your OS');
        process.exit(1);
}

if (destination) {
    mkdirpSync(destination);
    fs.copyFileSync(
        MANIFEST_PATH
      , path.join(destination, MANIFEST_NAME)
    );
}
