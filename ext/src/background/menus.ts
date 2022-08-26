"use strict";

import logger from "../lib/logger";
import options from "../lib/options";
import { stringify } from "../lib/utils";

import { ReceiverSelectorMediaType } from "../types";

import ReceiverSelector, { ReceiverSelection } from "./ReceiverSelector";
import castManager from "./castManager";

const _ = browser.i18n.getMessage;

const URL_PATTERN_HTTP = "http://*/*";
const URL_PATTERN_HTTPS = "https://*/*";
const URL_PATTERN_FILE = "file://*/*";

const URL_PATTERNS_REMOTE = [URL_PATTERN_HTTP, URL_PATTERN_HTTPS];
const URL_PATTERNS_ALL = [...URL_PATTERNS_REMOTE, URL_PATTERN_FILE];

type MenuId = string | number;

let menuIdCast: MenuId;
let menuIdCastMedia: MenuId;
let menuIdWhitelist: MenuId;
let menuIdWhitelistRecommended: MenuId;

/** Match patterns for the whitelist option menus. */
const whitelistChildMenuPatterns = new Map<MenuId, string>();

/** Handles initial menu setup. */
export async function initMenus() {
    logger.info("init (menus)");

    const opts = await options.getAll();

    // Global "Cast..." menu item
    menuIdCast = browser.menus.create({
        contexts: ["browser_action", "page", "tools_menu"],
        title: _("contextCast"),
        documentUrlPatterns: ["http://*/*", "https://*/*"],
        icons: { "16": "icons/icon.svg" } // browser_action context
    });

    // <video>/<audio> "Cast..." context menu item
    menuIdCastMedia = browser.menus.create({
        contexts: ["audio", "video", "image"],
        title: _("contextCast"),
        visible: opts.mediaEnabled,
        targetUrlPatterns: opts.localMediaEnabled
            ? URL_PATTERNS_ALL
            : URL_PATTERNS_REMOTE
    });

    menuIdWhitelist = browser.menus.create({
        contexts: ["browser_action"],
        title: _("contextAddToWhitelist"),
        enabled: false
    });

    menuIdWhitelistRecommended = browser.menus.create({
        title: _("contextAddToWhitelistRecommended"),
        parentId: menuIdWhitelist
    });

    browser.menus.create({
        type: "separator",
        parentId: menuIdWhitelist
    });

    // Popup context menus
    const popupUrlPattern = `${browser.runtime.getURL("ui/popup")}/*`;
    browser.menus.create({
        id: "popup_cast",
        title: _("popupCastButtonTitle"),
        documentUrlPatterns: [popupUrlPattern]
    });
    browser.menus.create({
        id: "popup_stop",
        title: _("popupStopButtonTitle"),
        documentUrlPatterns: [popupUrlPattern]
    });

    browser.menus.onShown.addListener(onMenuShown);
    browser.menus.onClicked.addListener(onMenuClicked);

    options.addEventListener("changed", async ev => {
        const alteredOpts = ev.detail;
        const newOpts = await options.getAll();

        if (menuIdCastMedia && alteredOpts.includes("mediaEnabled")) {
            browser.menus.update(menuIdCastMedia, {
                visible: newOpts.mediaEnabled
            });
        }

        if (menuIdCastMedia && alteredOpts.includes("localMediaEnabled")) {
            browser.menus.update(menuIdCastMedia, {
                targetUrlPatterns: newOpts.localMediaEnabled
                    ? URL_PATTERNS_ALL
                    : URL_PATTERNS_REMOTE
            });
        }
    });
}

/** Handle updating menus when shown. */
async function onMenuShown(info: browser.menus._OnShownInfo) {
    const menuIds = info.menuIds as unknown as number[];

    // Only rebuild menus if whitelist menu present
    if (menuIds.includes(menuIdWhitelist as number)) {
        updateWhitelistMenu(info.pageUrl);
        return;
    }
}

/** Handle menu click events */
async function onMenuClicked(
    info: browser.menus.OnClickData,
    tab?: browser.tabs.Tab
) {
    // Handle whitelist menus
    if (info.parentMenuItemId === menuIdWhitelist) {
        const pattern = whitelistChildMenuPatterns.get(info.menuItemId);
        if (!pattern) {
            throw logger.error(
                `Whitelist pattern not found for menu item ID ${info.menuItemId}.`
            );
        }

        const whitelist = await options.get("siteWhitelist");
        if (!whitelist.find(item => item.pattern === pattern)) {
            // Add to whitelist and update options
            whitelist.push({ pattern, isEnabled: true });
            await options.set("siteWhitelist", whitelist);
        }

        return;
    }

    // Handle cast menus
    const castMenuClicked = info.menuItemId === menuIdCast;
    const castMediaMenuClicked = info.menuItemId === menuIdCastMedia;
    if (castMenuClicked || castMediaMenuClicked) {
        if (tab?.id === undefined) {
            throw logger.error("Menu handler tab ID not found.");
        }
        if (!info.pageUrl) {
            throw logger.error("Menu handler page URL not found.");
        }

        let selection: Nullable<ReceiverSelection> = null;
        try {
            selection = await ReceiverSelector.getSelection(
                tab.id,
                info.frameId,
                {
                    withMediaSender: castMediaMenuClicked
                }
            );
        } catch (err) {
            logger.error("Failed to get receiver selection (cast menu)", err);
            return;
        }
        // Invalid selection result
        if (!selection) return;

        if (castMenuClicked) {
            castManager.loadSender({
                tabId: tab.id,
                frameId: info.frameId,
                selection
            });
        } else if (castMediaMenuClicked) {
            /**
             * If the selected media type is App, that refers to
             * the media sender in this context, so load media
             * sender.
             */
            if (selection.mediaType === ReceiverSelectorMediaType.App) {
                await browser.tabs.executeScript(tab.id, {
                    code: stringify`
                            window.receiver = ${selection.receiverDevice};
                            window.mediaUrl = ${info.srcUrl};
                            window.targetElementId = ${info.targetElementId};
                        `,
                    frameId: info.frameId
                });

                await browser.tabs.executeScript(tab.id, {
                    file: "cast/senders/media/index.js",
                    frameId: info.frameId
                });
            } else {
                // Handle other responses
                castManager.loadSender({
                    tabId: tab.id,
                    frameId: info.frameId,
                    selection
                });
            }
        }
    }
}

/** Handles updating the whitelist menus for a given URL */
async function updateWhitelistMenu(pageUrl?: string) {
    /**
     * If page URL doesn't exist, we're not on a page and have nothing
     * to whitelist, so disable the menu and return.
     */
    if (!pageUrl) {
        browser.menus.update(menuIdWhitelist, {
            enabled: false
        });

        browser.menus.refresh();
        return;
    }

    const url = new URL(pageUrl);
    const urlHasOrigin = url.origin !== "null";

    /**
     * If the page URL doesn't have an origin, we're not on a
     * remote page and have nothing to whitelist, so disable the
     * menu and return.
     */
    if (!urlHasOrigin) {
        browser.menus.update(menuIdWhitelist, {
            enabled: false
        });

        browser.menus.refresh();
        return;
    }

    // Enable the whitelist menu
    browser.menus.update(menuIdWhitelist, {
        enabled: true
    });

    for (const [menuId] of whitelistChildMenuPatterns) {
        // Clear all page-specific temporary menus
        if (menuId !== menuIdWhitelistRecommended) {
            browser.menus.remove(menuId);
        }

        whitelistChildMenuPatterns.delete(menuId);
    }

    // If there is more than one subdomain, get the base domain
    const baseDomain =
        (url.hostname.match(/\./g) || []).length > 1
            ? url.hostname.substring(url.hostname.indexOf(".") + 1)
            : url.hostname;

    const portlessOrigin = `${url.protocol}//${url.hostname}`;

    const patternRecommended = `${portlessOrigin}/*`;
    const patternSearch = `${portlessOrigin}${url.pathname}${url.search}`;
    const patternWildcardProtocol = `*://${url.hostname}/*`;
    const patternWildcardSubdomain = `${url.protocol}//*.${baseDomain}/*`;
    const patternWildcardProtocolAndSubdomain = `*://*.${baseDomain}/*`;

    // Update recommended menu item
    browser.menus.update(menuIdWhitelistRecommended, {
        title: _("contextAddToWhitelistRecommended", patternRecommended)
    });

    whitelistChildMenuPatterns.set(
        menuIdWhitelistRecommended,
        patternRecommended
    );

    if (url.search) {
        const whitelistSearchMenuId = browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd", patternSearch),
            parentId: menuIdWhitelist
        });

        whitelistChildMenuPatterns.set(whitelistSearchMenuId, patternSearch);
    }

    /**
     * Split URL path into segments and add menu items for each
     * partial path as the segments are removed.
     */
    {
        const pathTrimmed = url.pathname.endsWith("/")
            ? url.pathname.substring(0, url.pathname.length - 1)
            : url.pathname;

        const pathSegments = pathTrimmed
            .split("/")
            .filter(segment => segment)
            .reverse();

        if (pathSegments.length) {
            for (let i = 0; i < pathSegments.length; i++) {
                const partialPath = pathSegments.slice(i).reverse().join("/");

                const pattern = `${portlessOrigin}/${partialPath}/*`;

                const partialPathMenuId = browser.menus.create({
                    title: _("contextAddToWhitelistAdvancedAdd", pattern),
                    parentId: menuIdWhitelist
                });

                whitelistChildMenuPatterns.set(partialPathMenuId, pattern);
            }
        }
    }

    const wildcardProtocolMenuId = browser.menus.create({
        title: _("contextAddToWhitelistAdvancedAdd", patternWildcardProtocol),
        parentId: menuIdWhitelist
    });

    whitelistChildMenuPatterns.set(
        wildcardProtocolMenuId,
        patternWildcardProtocol
    );

    const wildcardSubdomainMenuId = browser.menus.create({
        title: _("contextAddToWhitelistAdvancedAdd", patternWildcardSubdomain),
        parentId: menuIdWhitelist
    });

    whitelistChildMenuPatterns.set(
        wildcardSubdomainMenuId,
        patternWildcardSubdomain
    );

    const wildcardProtocolAndSubdomainMenuId = browser.menus.create({
        title: _(
            "contextAddToWhitelistAdvancedAdd",
            patternWildcardProtocolAndSubdomain
        ),
        parentId: menuIdWhitelist
    });

    whitelistChildMenuPatterns.set(
        wildcardProtocolAndSubdomainMenuId,
        patternWildcardProtocolAndSubdomain
    );

    await browser.menus.refresh();
}
