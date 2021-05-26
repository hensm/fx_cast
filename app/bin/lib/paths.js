"use strict";

const path = require("path");

const { __applicationName
      , __applicationDirectoryName
      , __applicationExecutableName } = require("../../package.json");


const rootPath = path.join(__dirname, "../../../");

exports.DIST_PATH = path.join(rootPath, "dist/app");
exports.LICENSE_PATH = path.join(rootPath, "LICENSE");

exports.REGISTRY_KEY = __applicationName;

exports.pkgPlatformMap = {
    win32: "win"
  , darwin: "macos"
  , linux: "linux"
};

exports.MANIFEST_NAME = `${__applicationName}.json`;

exports.getExecutableName = platform => {
    switch (platform) {
        case "win32":
            return `${__applicationExecutableName}.exe`;
        case "darwin":
        case "linux":
            return __applicationExecutableName;
    }
}

exports.getExecutablePath = (platform, arch) => {
    const EXECUTABLE_PATH_WIN32_X64 = `C:\\Program Files\\${__applicationDirectoryName}\\`;
    const EXECUTABLE_PATH_WIN32_X86 = `C:\\Program Files (x86)\\${__applicationDirectoryName}\\`;
    const EXECUTABLE_PATH_DARWIN = `/Library/Application Support/${__applicationDirectoryName}/`;
    const EXECUTABLE_PATH_LINUX = `/opt/${__applicationDirectoryName}/`;

    switch (platform) {
        case "win32":
            switch (arch) {
                case "x86": return EXECUTABLE_PATH_WIN32_X86;
                case "x64": return EXECUTABLE_PATH_WIN32_X64;
            }
            break;
        case "darwin": return EXECUTABLE_PATH_DARWIN;
        case "linux":  return EXECUTABLE_PATH_LINUX;
    }
};

exports.getManifestPath = (platform, arch, linuxPackageType) => {
    const MANIFEST_PATH_DARWIN = "/Library/Application Support/Mozilla/NativeMessagingHosts/";
    const MANIFEST_PATH_LINUX_DEB = "/usr/lib/mozilla/native-messaging-hosts/";
    const MANIFEST_PATH_LINUX_RPM ="/usr/lib64/mozilla/native-messaging-hosts/";

    switch (platform) {
        case "win32":
            switch (arch) {
                case "x86":
                case "x64": return exports.getExecutablePath(platform, arch);
            }
            break;
        case "darwin": return MANIFEST_PATH_DARWIN;
        case "linux":
            switch (linuxPackageType) {
                case "deb": return MANIFEST_PATH_LINUX_DEB;
                case "rpm": return MANIFEST_PATH_LINUX_RPM;
            }

            break;
    }
};
