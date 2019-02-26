"use strict";

const PLATFORM_MAC = "Macintosh; Intel Mac OS X 10_14_1";
const PLATFORM_WIN = "Windows NT 10.0; Win64; x64";
const PLATFORM_LINUX = "Mozilla/5.0 (X11; Linux x86_64";

const UA_PREFIX = "Mozilla/5.0";

const UA_CHROME = "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.67 Safari/537.36";
const UA_SAFARI = "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15";


export function getChromeUserAgent (platform: string): string {
    let platformComponent: string;
    switch (platform) {
        case "mac": platformComponent = PLATFORM_MAC; break;
        case "win": platformComponent = PLATFORM_WIN; break;
        case "linux": platformComponent = PLATFORM_LINUX; break;
    }

    return `${UA_PREFIX} (${platformComponent}) ${UA_CHROME}`;
}

export function getSafariUserAgent (platform: string): string {
    return `${UA_PREFIX} (${PLATFORM_MAC}) ${UA_SAFARI}`;
}
