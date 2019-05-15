"use strict";

import semver from "semver";
import nativeMessaging from "./nativeMessaging";

export interface BridgeInfo {
    name: string;
    version: string;
    expectedVersion: string;
    isVersionExact: boolean;
    isVersionCompatible: boolean;
    isVersionOlder: boolean;
    isVersionNewer: boolean;
}

export default async function getBridgeInfo (): Promise<BridgeInfo> {
    let applicationVersion: string;
    try {
        applicationVersion = await nativeMessaging.sendNativeMessage(
                APPLICATION_NAME
              , { subject: "bridge:/getInfo"
                , data: EXTENSION_VERSION });
    } catch (err) {
        return null;
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
        console.error(`Expecting ${APPLICATION_NAME} v${APPLICATION_VERSION}, found v${applicationVersion}.`
              , isVersionOlder
                    ? "Try updating the native app to the latest version."
                    : "Try updating the extension to the latest version");
    }

    return {
        name: APPLICATION_NAME
      , version: applicationVersion
      , expectedVersion: APPLICATION_VERSION

        // Version info
      , isVersionExact
      , isVersionCompatible
      , isVersionOlder
      , isVersionNewer
    };
}
