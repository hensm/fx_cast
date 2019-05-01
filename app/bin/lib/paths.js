const path = require("path");

const { __applicationName
      , __applicationDirectoryName
      , __applicationExecutableName } = require("../../package.json");


const rootPath = path.join(__dirname, "../../../");

exports.DIST_PATH = path.join(rootPath, "dist/app");
exports.LICENSE_PATH = path.join(rootPath, "LICENSE");
exports.WIN_REGISTRY_KEY = __applicationName;

exports.executableName = {
    win32: `${__applicationExecutableName}.exe`
  , darwin: __applicationExecutableName
  , linux: __applicationExecutableName
};

exports.executablePath = {
    win32: `C:\\Program Files\\${__applicationDirectoryName}\\`
  , darwin: `/Library/Application Support/${__applicationDirectoryName}/`
  , linux: `/opt/${__applicationDirectoryName}/`
};

exports.manifestName = `${__applicationName}.json`;

exports.manifestPath = {
    win32: `C:\\Program Files\\${__applicationDirectoryName}\\`
  , darwin: "/Library/Application Support/Mozilla/NativeMessagingHosts/"
  , linux: {
        deb: "/usr/lib/mozilla/native-messaging-hosts/"
      , rpm: "/usr/lib64/mozilla/native-messaging-hosts/"
    }
};

exports.selectorExecutableName = "selector";

exports.pkgPlatform = {
    win32: "win"
  , darwin: "macos"
  , linux: "linux"
};
