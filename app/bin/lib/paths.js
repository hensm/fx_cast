// @ts-check

import path from "path";
import url from "url";

import config from "./config.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const rootPath = path.join(__dirname, "../../../");

export const DIST_PATH = path.join(rootPath, "dist/app");
export const LICENSE_PATH = path.join(rootPath, "LICENSE");

export const REGISTRY_KEY = config.applicationName;

export const pkgPlatformMap = {
    win32: "win",
    darwin: "macos",
    linux: "linux"
};

export const MANIFEST_NAME = `${config.applicationName}.json`;

/**
 * @param {string} platform
 * @returns {string}
 */
export function getExecutableName(platform) {
    switch (platform) {
        case "win32":
            return `${config.applicationExecutableName}.exe`;
        case "darwin":
        case "linux":
            return config.applicationExecutableName;
    }

    throw new Error("No executable name for specified platform!");
}

/**
 * @param {string} platform
 * @param {string} arch
 * @returns {string}
 */
export function getExecutableDirectory(platform, arch) {
    const EXECUTABLE_DIR_WIN32_X64 = `C:\\Program Files\\${config.applicationDirectoryName}\\`;
    const EXECUTABLE_DIR_WIN32_X86 = `C:\\Program Files (x86)\\${config.applicationDirectoryName}\\`;
    const EXECUTABLE_DIR_DARWIN = `/Library/Application Support/${config.applicationDirectoryName}/`;
    const EXECUTABLE_DIR_LINUX = `/opt/${config.applicationDirectoryName}/`;

    switch (platform) {
        case "win32":
            switch (arch) {
                case "x86":
                    return EXECUTABLE_DIR_WIN32_X86;
                case "x64":
                    return EXECUTABLE_DIR_WIN32_X64;
            }
            break;
        case "darwin":
            return EXECUTABLE_DIR_DARWIN;
        case "linux":
            return EXECUTABLE_DIR_LINUX;
    }

    throw new Error("No executable directory for specified platform!");
}

/**
 * @param {string} platform
 * @param {string} arch
 * @param {string} [linuxPackageType]
 * @returns {string}
 */
export function getManifestDirectory(platform, arch, linuxPackageType) {
    const MANIFEST_DIR_DARWIN =
        "/Library/Application Support/Mozilla/NativeMessagingHosts/";
    const MANIFEST_DIR_LINUX_DEB = "/usr/lib/mozilla/native-messaging-hosts/";
    const MANIFEST_DIR_LINUX_RPM = "/usr/lib64/mozilla/native-messaging-hosts/";

    switch (platform) {
        case "win32":
            return getExecutableDirectory(platform, arch);
        case "darwin":
            return MANIFEST_DIR_DARWIN;
        case "linux":
            switch (linuxPackageType) {
                case "deb":
                    return MANIFEST_DIR_LINUX_DEB;
                case "rpm":
                    return MANIFEST_DIR_LINUX_RPM;
            }

            break;
    }

    throw new Error("No manifest directory for specified platform!");
}
