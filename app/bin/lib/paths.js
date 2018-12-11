const path = require("path");

const { __applicationName
      , __applicationDirectoryName
      , __applicationExecutableName } = require("../../package.json");


exports.DIST_PATH = path.join(__dirname, "../../../dist/app");

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
  , linux: "/usr/lib/mozilla/native-messaging-hosts/"
};

exports.pkgPlatform = {
    win32: "win"
  , darwin: "macos"
  , linux: "linux"
};
