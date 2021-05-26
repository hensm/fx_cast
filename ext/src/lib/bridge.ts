"use strict";

import semver from "semver";

import logger from "./logger";
import { Port } from "../messaging";
import nativeMessaging from "./nativeMessaging";
import options from "./options";


export const BRIDGE_TIMEOUT = 5000;

/**
 * Creates a bridge instance and returns a message port.
 */
async function connect(): Promise<Port> {
    const applicationName = await options.get("bridgeApplicationName");
    const bridgePort = nativeMessaging.connectNative(applicationName) as
            unknown as Port;

    bridgePort.onDisconnect.addListener(() => {
        if (bridgePort.error) {
            console.error(`${applicationName} disconnected:`
                  , bridgePort.error.message);
        } else {
            console.info(`${applicationName} disconnected`);
        }
    });

    return bridgePort;
}


export interface BridgeInfo {
    name: string;
    version: string;
    expectedVersion: string;
    isVersionExact: boolean;
    isVersionCompatible: boolean;
    isVersionOlder: boolean;
    isVersionNewer: boolean;
}

export class BridgeConnectionError extends Error {}
export class BridgeTimedOutError extends Error {}

/**
 * Creates a temporary bridge to query the version info,
 * compares the version to the extension version using semver
 * rules to determine compatiblity, then returns a
 * BridgeInfo object.
 */
const getInfo = () => new Promise<BridgeInfo>(async (resolve, reject) => {
    const applicationName = await options.get("bridgeApplicationName");
    if (!applicationName) {
        reject(logger.error("Bridge application name not found."));
        return;
    }

    const bridgeTimeoutId = setTimeout(() => {
        logger.error("Bridge timed out.");
        reject(new BridgeTimedOutError());
    }, BRIDGE_TIMEOUT);

    let applicationVersion: string;
    try {
        const { version } = browser.runtime.getManifest();

        applicationVersion = await nativeMessaging.sendNativeMessage(
                applicationName
              , { subject: "bridge:/getInfo"
                , data: version });
    } catch (err) {
        logger.error("Bridge connection failed.");
        reject(new BridgeConnectionError());
        clearTimeout(bridgeTimeoutId);

        return;
    }

    clearTimeout(bridgeTimeoutId);

    const extensionVersion = browser.runtime.getManifest().version;
    const extensionVersionMajor = semver.major(extensionVersion);

    const versionDiff = semver.diff(applicationVersion, extensionVersion);

    /**
     * If the target version is above 0.x.x range, API is stable
     * and versions with minor or patch level changes should be
     * compatible.
     */
    const isVersionCompatible =
            semver.eq(applicationVersion, extensionVersion)
         || (versionDiff !== "major" && extensionVersionMajor !== 0)
         || (versionDiff === "patch" && extensionVersionMajor === 0);

    const isVersionExact = semver.eq(applicationVersion, extensionVersion);
    const isVersionOlder = semver.lt(applicationVersion, extensionVersion);
    const isVersionNewer = semver.gt(applicationVersion, extensionVersion);

    // Print compatibility info to console
    if (!isVersionCompatible) {
        logger.error(`Expecting ${applicationName} v${BRIDGE_VERSION}, found v${applicationVersion}. ${
                isVersionOlder
                    ? "Try updating the native app to the latest version."
                    : "Try updating the extension to the latest version"}`);
    }

    resolve({
        name: applicationName
      , version: applicationVersion
      , expectedVersion: BRIDGE_VERSION

        // Version info
      , isVersionExact
      , isVersionCompatible
      , isVersionOlder
      , isVersionNewer
    });
});

export default {
    connect
  , getInfo
};
