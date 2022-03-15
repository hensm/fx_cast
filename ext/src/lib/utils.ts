"use strict";

import logger from "./logger";

import { ReceiverSelectorMediaType } from "../background/receiverSelector";

export function getNextEllipsis(ellipsis: string): string {
    if (ellipsis === "") return ".";
    if (ellipsis === ".") return "..";
    if (ellipsis === "..") return "...";
    if (ellipsis === "...") return "";

    return "";
}

/**
 * Template literal tag function, JSON-encodes substitutions.
 */
export function stringify(
    templateStrings: TemplateStringsArray,
    ...substitutions: any[]
) {
    let formattedString = "";

    for (const templateString of templateStrings) {
        if (formattedString) {
            formattedString += JSON.stringify(substitutions.shift());
        }

        formattedString += templateString;
    }

    return formattedString;
}

export function getMediaTypesForPageUrl(
    pageUrl: string
): ReceiverSelectorMediaType {
    const url = new URL(pageUrl);
    let availableMediaTypes = ReceiverSelectorMediaType.None;

    /**
     * Content scripts are prohibited from running on some
     * Mozilla domains.
     */
    const blockedHosts = [
        "accounts-static.cdn.mozilla.net",
        "accounts.firefox.com",
        "addons.cdn.mozilla.net",
        "addons.mozilla.org",
        "api.accounts.firefox.com",
        "content.cdn.mozilla.net",
        "discovery.addons.mozilla.org",
        "install.mozilla.org",
        "oauth.accounts.firefox.com",
        "profile.accounts.firefox.com",
        "support.mozilla.org",
        "sync.services.mozilla.com"
    ];

    if (blockedHosts.includes(url.host)) {
        return availableMediaTypes;
    }

    // Only meant to run on normal web pages
    if (url.protocol === "http:" || url.protocol === "https:") {
        availableMediaTypes |= ReceiverSelectorMediaType.Tab;
    }

    /**
     * When on an insecure origin, MediaDevices.getDisplayMedia
     * will not exist (and legacy MediaDevices.getUserMedia
     * mediaSource constraint will fail).
     */
    if (url.protocol === "https:") {
        availableMediaTypes |= ReceiverSelectorMediaType.Screen;
    }

    return availableMediaTypes;
}

export interface WindowCenteredProps {
    width: number;
    height: number;
    left: number;
    top: number;
}

export function getWindowCenteredProps(
    refWin: browser.windows.Window,
    width: number,
    height: number
): WindowCenteredProps {
    if (
        refWin.left === undefined ||
        refWin.width === undefined ||
        refWin.top === undefined ||
        refWin.height === undefined
    ) {
        throw logger.error("refWin missing positional attributes.");
    }

    const centerX = refWin.left + refWin.width / 2;
    const centerY = refWin.top + refWin.height / 3;

    return {
        width,
        height,
        left: Math.floor(centerX - width / 2),
        top: Math.floor(centerY - height / 2)
    };
}

export const REMOTE_MATCH_PATTERN_REGEX =
    /^(?:(?:(\*|https?|ftp):\/\/(\*|(?:\*\.(?:[^\/\*:]\.?)+(?:[^\.])|[^\/\*:]*))?)(\/.*)|<all_urls>)$/;

export function loadScript(
    scriptUrl: string,
    doc: Document = document
): HTMLScriptElement {
    const scriptElement = doc.createElement("script");
    scriptElement.src = scriptUrl;
    (doc.head || doc.documentElement).append(scriptElement);

    return scriptElement;
}
