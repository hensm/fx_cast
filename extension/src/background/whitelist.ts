import logger from "../lib/logger";
import options from "../lib/options";

import { cacheUaInfo, getChromeUserAgentString } from "../lib/userAgents";
import { RemoteMatchPattern } from "../lib/matchPattern";

import {
    CAST_FRAMEWORK_LOADER_SCRIPT_URL,
    CAST_LOADER_SCRIPT_URL
} from "../cast/urls";

// Missing on @types/firefox-webext-browser
type OnBeforeSendHeadersDetails = Parameters<
    Parameters<typeof browser.webRequest.onBeforeSendHeaders.addListener>[0]
>[0] & {
    frameAncestors?: Array<{ url: string; frameId: number }>;
};
type OnBeforeRequestDetails = Parameters<
    Parameters<typeof browser.webRequest.onBeforeRequest.addListener>[0]
>[0] & {
    frameAncestors?: Array<{ url: string; frameId: number }>;
};

export interface WhitelistItemData {
    pattern: string;
    isEnabled: boolean;
    isUserAgentDisabled?: boolean;
    customUserAgent?: string;
}

let matchPatterns: RemoteMatchPattern[] = [];

let platform: string;
let chromeUserAgent: string | undefined;
let chromeUserAgentHybrid: string | undefined;

let siteWhitelistEnabled = false;
let siteWhitelist: Nullable<WhitelistItemData[]> = null;
let customUserAgent: string | undefined;

export async function initWhitelist() {
    logger.info("init (whitelist)");

    await cacheUaInfo();

    if (!platform) {
        const browserInfo = await browser.runtime.getBrowserInfo();

        // TODO: Allow hybrid UA to be configurable
        platform = (await browser.runtime.getPlatformInfo()).os;
        chromeUserAgent = await getChromeUserAgentString(platform);
        chromeUserAgentHybrid = await getChromeUserAgentString(platform, {
            hybridFirefoxVersion: browserInfo.version
        });
        if (!chromeUserAgent) {
            throw logger.error("Failed to get Chrome UA string");
        }

        customUserAgent = await options.get("siteWhitelistCustomUserAgent");
    }

    // Register on first run
    await registerSiteWhitelist();

    options.addEventListener("changed", async ev => {
        // Update custom UA on change
        if (ev.detail.includes("siteWhitelistCustomUserAgent")) {
            customUserAgent = await options.get("siteWhitelistCustomUserAgent");
        }
        // Re-register whitelist on change
        if (
            ev.detail.includes("siteWhitelist") ||
            ev.detail.includes("siteWhitelistEnabled")
        ) {
            unregisterSiteWhitelist();
            registerSiteWhitelist();
        }
    });
}

/**
 * Returns the configured user agent matching the specified URL or
 * undefined if the user agent is disabled.
 */
function getUserAgent(url: string, host?: string): Optional<string> {
    if (!siteWhitelistEnabled || !siteWhitelist) return;

    // Search site-specific user agents
    const matchingItem = siteWhitelist.find(
        item =>
            item.customUserAgent &&
            new RemoteMatchPattern(item.pattern).matches(url)
    );
    if (matchingItem) {
        if (!matchingItem.isEnabled || matchingItem.isUserAgentDisabled) return;
        return matchingItem.customUserAgent;
    }

    return (
        customUserAgent ||
        (host === "www.youtube.com" ? chromeUserAgentHybrid : chromeUserAgent)
    );
}

/**
 * Override User-Agent header for requests to whitelisted URLs. Sites
 * with Chromecast support will usually only load the Cast SDK if they
 * detect a Chrome user agent string.
 */
async function onWhitelistedBeforeSendHeaders(
    details: OnBeforeSendHeadersDetails
) {
    if (!details.requestHeaders) {
        throw logger.error(
            "OnBeforeSendHeaders handler details missing requestHeaders."
        );
    }

    const host = details.requestHeaders.find(header => header.name === "Host");

    for (const header of details.requestHeaders) {
        if (header.name === "User-Agent") {
            header.value = getUserAgent(details.url, host?.value);
            break;
        }
    }

    return {
        requestHeaders: details.requestHeaders
    };
}

/**
 * Override User-Agent header for requests from child frames of
 * whitelisted URLs to support embedded players on other origins (e.g.
 * CDN domains).
 */
function onWhitelistedChildBeforeSendHeaders(
    details: OnBeforeSendHeadersDetails
) {
    if (!details.requestHeaders || !details.frameAncestors) {
        return;
    }

    for (const ancestor of details.frameAncestors) {
        // If no matching patterns
        if (!matchPatterns.some(pattern => pattern.matches(ancestor.url))) {
            continue;
        }

        // Override User-Agent header
        const requestHeaders = details.requestHeaders;
        for (const header of requestHeaders) {
            if (header.name === "User-Agent") {
                const host = requestHeaders.find(
                    header => header.name === "Host"
                );
                header.value = getUserAgent(details.url, host?.value);
                break;
            }
        }

        return { requestHeaders };
    }
}

/**
 * Handle requests to cast_sender.js SDK loader script and redirect to
 * the extension's implementation.
 */
async function onBeforeCastSDKRequest(details: OnBeforeRequestDetails) {
    if (!details.originUrl || details.tabId === -1) {
        return {};
    }

    // Test against whitelist if enabled
    if (await options.get("siteWhitelistEnabled")) {
        /**
         * Frame ancestor URLs (if present) or origin URL that the SDK
         * is loaded from.
         */
        const urls = [
            ...(details.frameAncestors?.map(ancestor => ancestor.url) ?? []),
            details.originUrl
        ];

        // Allow request if no whitelist matches
        if (
            !urls.some(url =>
                matchPatterns.some(pattern => pattern.matches(url))
            )
        ) {
            return {};
        }
    }

    await browser.tabs.executeScript(details.tabId, {
        code: `
            window.isFramework = ${
                details.url === CAST_FRAMEWORK_LOADER_SCRIPT_URL
            };
        `,
        frameId: details.frameId,
        runAt: "document_start"
    });

    await browser.tabs.executeScript(details.tabId, {
        file: "cast/contentBridge.js",
        frameId: details.frameId,
        runAt: "document_start"
    });

    return {
        redirectUrl: browser.runtime.getURL("cast/content.js")
    };
}

async function registerSiteWhitelist() {
    const opts = await options.getAll();
    siteWhitelist = opts.siteWhitelist;
    siteWhitelistEnabled = opts.siteWhitelistEnabled;

    // Parse match patterns once
    matchPatterns = siteWhitelist.map(
        item => new RemoteMatchPattern(item.pattern)
    );

    browser.webRequest.onBeforeRequest.addListener(
        onBeforeCastSDKRequest,
        { urls: [CAST_LOADER_SCRIPT_URL, CAST_FRAMEWORK_LOADER_SCRIPT_URL] },
        ["blocking"]
    );

    // Skip whitelist request listeners if disabled or empty
    if (!siteWhitelistEnabled || !siteWhitelist.length) {
        return;
    }

    browser.webRequest.onBeforeSendHeaders.addListener(
        onWhitelistedBeforeSendHeaders,
        {
            // Filter for items with UA enabled
            urls: siteWhitelist.flatMap(item =>
                item.isEnabled && !item.isUserAgentDisabled
                    ? [item.pattern]
                    : []
            )
        },
        ["blocking", "requestHeaders"]
    );

    browser.webRequest.onBeforeSendHeaders.addListener(
        onWhitelistedChildBeforeSendHeaders,
        { urls: ["<all_urls>"] },
        ["blocking", "requestHeaders"]
    );

    browser.contentScripts.register({
        matches: siteWhitelist.map(item => item.pattern),
        js: [{ file: "cast/contentInitial.js" }],
        runAt: "document_start",
        allFrames: true
    });
}

function unregisterSiteWhitelist() {
    browser.webRequest.onBeforeSendHeaders.removeListener(
        onWhitelistedBeforeSendHeaders
    );
    browser.webRequest.onBeforeSendHeaders.removeListener(
        onWhitelistedChildBeforeSendHeaders
    );
    browser.webRequest.onBeforeRequest.removeListener(onBeforeCastSDKRequest);
}
