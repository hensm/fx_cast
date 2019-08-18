"use strict";

const PLATFORM_MAC = "Macintosh; Intel Mac OS X 10_14_1";
const PLATFORM_WIN = "Windows NT 10.0; Win64; x64";
const PLATFORM_LINUX = "Mozilla/5.0 (X11; Linux x86_64";

const UA_PREFIX = "Mozilla/5.0";

const UA_CHROME = "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.67 Safari/537.36";
const UA_CHROME_LEGACY = "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2883.87 Safari/537.36";
const UA_SAFARI = "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15";


function getPlatformComponent (platform: string): string {
    switch (platform) {
        case "mac": return PLATFORM_MAC; break;
        case "win": return PLATFORM_WIN; break;
        case "linux": return PLATFORM_LINUX; break;
    }
}

export function getChromeUserAgent (
        platform: string
      , legacy: boolean = false): string {

    const platformComponent = getPlatformComponent(platform);
    const browserComponent = legacy
        ? UA_CHROME_LEGACY
        : UA_CHROME;

    return `${UA_PREFIX} (${platformComponent}) ${browserComponent}`;
}

export function getSafariUserAgent (): string {
    return `${UA_PREFIX} (${PLATFORM_MAC}) ${UA_SAFARI}`;
}
