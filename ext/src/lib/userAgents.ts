"use strict";

const PLATFORM_MAC = "Macintosh; Intel Mac OS X 12_5";
const PLATFORM_MAC_HYBRID = "Macintosh; Intel Mac OS X 12_5; rv:103.0";
const PLATFORM_WIN = "Windows NT 10.0; Win64; x64";
const PLATFORM_LINUX = "X11; Linux x86_64";

const UA_CHROME =
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36";
const UA_HYBRID = "Chrome/104.0.0.0 Gecko/20100101 Firefox/103.0";

export function getChromeUserAgent(platform: string, hybrid = false) {
    let platformComponent: string;
    if (platform === "mac") {
        platformComponent = hybrid ? PLATFORM_MAC_HYBRID : PLATFORM_MAC;
    } else if (platform === "win") {
        platformComponent = PLATFORM_WIN;
    } else if (platform === "linux") {
        platformComponent = PLATFORM_LINUX;
    } else {
        return;
    }

    const browserComponent = hybrid ? UA_HYBRID : UA_CHROME;

    return `Mozilla/5.0 (${platformComponent}) ${browserComponent}`;
}
