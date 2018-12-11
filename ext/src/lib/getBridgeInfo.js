import semver from "semver";

export default async function getBridgeInfo () {
    let applicationVersion;
    try {
        const response = await browser.runtime.sendNativeMessage(
                APPLICATION_NAME
              , { subject: "bridge:getInfo"
                , data: EXTENSION_VERSION });

        applicationVersion = response.data;
    } catch (err) {
        return null;
    }

    /**
     * Compare installed bridge version to the version the
     * extension was built alongside and is known to be
     * compatible with.
     *
     * TODO: Determine compatibility with semver and enforce/notify
     * user.
     */
    if (applicationVersion !== APPLICATION_VERSION) {
        console.error(`Expecting ${APPLICATION_NAME} v${APPLICATION_VERSION}, found v${applicationVersion}.`
              , semver.lt(applicationVersion, APPLICATION_VERSION)
                    ? "Try updating the native app to the latest version."
                    : "Try updating the extension to the latest version");
    }

    return {
        version: applicationVersion
      , isVersionCompatible: applicationVersion === APPLICATION_VERSION
      , isVersionOlder: semver.lt(applicationVersion, APPLICATION_VERSION)
      , isVersionNewer: semver.gt(applicationVersion, APPLICATION_VERSION)
    };
}
