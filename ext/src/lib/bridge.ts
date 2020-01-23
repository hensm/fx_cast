"use strict";

import semver from "semver";

import logger from "./logger";
import nativeMessaging from "./nativeMessaging";
import options from "./options";


async function connect (): Promise<browser.runtime.Port> {
    const applicationName = await options.get("bridgeApplicationName");
    const bridgePort = nativeMessaging.connectNative(applicationName);

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

async function getInfo (): Promise<BridgeInfo> {
    const applicationName = await options.get("bridgeApplicationName");
    if (!applicationName) {
        throw logger.error("Bridge application name not found.");
    }

    let applicationVersion: string;

    try {
        const { version } = browser.runtime.getManifest();

        applicationVersion = await nativeMessaging.sendNativeMessage(
                applicationName
              , { subject: "bridge:/getInfo"
                , data: version });
    } catch (err) {
        throw logger.error("Failed to connect to bridge application");
    }

    /**
     * If the target version is above 0.x.x range, API is stable
     * and versions with minor or patch level changes should be
     * compatible.
     */
    const isVersionCompatible =
            semver.eq(applicationVersion, APPLICATION_VERSION)
         || semver.diff(applicationVersion, APPLICATION_VERSION) !== "major"
         && semver.major(APPLICATION_VERSION) !== 0;

    const isVersionExact = semver.eq(applicationVersion, APPLICATION_VERSION);
    const isVersionOlder = semver.lt(applicationVersion, APPLICATION_VERSION);
    const isVersionNewer = semver.gt(applicationVersion, APPLICATION_VERSION);

    // Print compatibility info to console
    if (!isVersionCompatible) {
        logger.error(`Expecting ${applicationName} v${APPLICATION_VERSION}, found v${applicationVersion}. ${
                isVersionOlder
                    ? "Try updating the native app to the latest version."
                    : "Try updating the extension to the latest version"}`);
    }

    return {
        name: applicationName
      , version: applicationVersion
      , expectedVersion: APPLICATION_VERSION

        // Version info
      , isVersionExact
      , isVersionCompatible
      , isVersionOlder
      , isVersionNewer
    };
}


export default {
    connect
  , getInfo
};
