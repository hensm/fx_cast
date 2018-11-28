const fs = require("fs-extra");
const os = require("os");
const path = require("path");

const { executableName
      , executablePath
      , manifestName
      , manifestPath
      , DIST_DIR_PATH } = require("./lib/paths");

const argv = require("minimist")(process.argv.slice(2));


const CURRENT_MANIFEST_PATH = path.join(DIST_DIR_PATH, manifestName);
const WIN_REGISTRY_KEY = "fx_cast_bridge";


if (!fs.existsSync(CURRENT_MANIFEST_PATH) && !argv.remove) {
    console.error("No manifest in dist/app/ to install");
    process.exit(1);
}

const platform = os.platform();

switch (platform) {
    case "darwin":
    case "linux": {
        const destination = path.join(os.homedir(), manifestPath[platform]);

        if (argv.remove) {
            fs.remove(path.join(destination, manifestName));
            break;
        }

        fs.ensureDirSync(destination);
        fs.copyFileSync(CURRENT_MANIFEST_PATH
              , path.join(destination, manifestName));

        break;
    };

    case "win32": {
        const regedit = require("regedit");

        if (argv.remove) {
            // TODO: no corresponding method in regedit lib
            break;
        }

        regedit.putValue({
            "HKEY_CURRENT_USER\\SOFTWARE\\Mozilla\\NativeMessagingHosts": {
                [WIN_REGISTRY_KEY]: {
                    value: CURRENT_MANIFEST_PATH
                  , type: "REG_DEFAULT"
                }
            }
        });

        break;
    };

    default:
        console.error("Sorry, this installer does not yet support your OS");
        process.exit(1);
}
