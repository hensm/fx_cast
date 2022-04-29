"use strict";

import { ReceiverSelectorMediaType } from "../types";

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
    ...substitutions: unknown[]
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

export function loadScript(
    scriptUrl: string,
    doc: Document = document
): Promise<HTMLScriptElement> {
    return new Promise((resolve, reject) => {
        const scriptEl = doc.createElement("script");
        scriptEl.src = scriptUrl;
        (doc.head || doc.documentElement).append(scriptEl);

        scriptEl.addEventListener("load", () => resolve(scriptEl));
        scriptEl.addEventListener("error", () => reject());
    });
}
