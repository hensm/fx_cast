"use strict";

import options from "../lib/options";
import { TypedEventTarget } from "../lib/typedEvents";


const _ = browser.i18n.getMessage;


const URL_PATTERN_HTTP = "http://*/*";
const URL_PATTERN_HTTPS = "https://*/*";
const URL_PATTERN_FILE = "file://*/*";

const URL_PATTERNS_REMOTE = [ URL_PATTERN_HTTP, URL_PATTERN_HTTPS ];
const URL_PATTERNS_ALL = [ ...URL_PATTERNS_REMOTE, URL_PATTERN_FILE ];


type MenuId = string | number;

let menuIdMediaCast: MenuId;
let menuIdMirroringCast: MenuId;
let menuIdWhitelist: MenuId;
let menuIdWhitelistRecommended: MenuId;

const whitelistChildMenuPatterns = new Map<MenuId, string>();


let hasCreatedMenus = false;

export default async function createMenus () {
    if (!hasCreatedMenus) {
        hasCreatedMenus = true;

        const opts = await options.getAll();

        // <video>/<audio> "Cast..." context menu item
        menuIdMediaCast = await browser.menus.create({
            contexts: [ "audio", "video" ]
          , title: _("contextCast")
          , visible: opts.mediaEnabled
          , targetUrlPatterns: opts.localMediaEnabled
                ? URL_PATTERNS_ALL
                : URL_PATTERNS_REMOTE
        });

        // Screen/Tab mirroring "Cast..." context menu item
        menuIdMirroringCast = await browser.menus.create({
            contexts: [ "browser_action", "page", "tools_menu" ]
          , title: _("contextCast")
          , visible: opts.mirroringEnabled

            // Mirroring doesn't work from file:// urls
          , documentUrlPatterns: URL_PATTERNS_REMOTE
        });


        menuIdWhitelist = await browser.menus.create({
            contexts: [ "browser_action" ]
          , title: _("contextAddToWhitelist")
          , enabled: false
        });

        menuIdWhitelistRecommended = await browser.menus.create({
            title: _("contextAddToWhitelistRecommended")
          , parentId: menuIdWhitelist
        });

        await browser.menus.create({
            type: "separator"
          , parentId: menuIdWhitelist
        });
    }

    return {
        menuIdMediaCast
      , menuIdMirroringCast
      , menuIdWhitelist
      , menuIdWhitelistRecommended
      , whitelistChildMenuPatterns
    };
}

options.addEventListener("changed", async ev => {
    const alteredOpts = ev.detail;
    const opts = await options.getAll();

    if (alteredOpts.includes("mirroringEnabled")) {
        browser.menus.update(menuIdMirroringCast, {
            visible: opts.mirroringEnabled
        });
    }

    if (alteredOpts.includes("mediaEnabled")) {
        browser.menus.update(menuIdMediaCast, {
            visible: opts.mediaEnabled
        });
    }

    if (alteredOpts.includes("localMediaEnabled")) {
        browser.menus.update(menuIdMediaCast, {
            targetUrlPatterns: opts.localMediaEnabled
                ? URL_PATTERNS_ALL
                : URL_PATTERNS_REMOTE
        });
    }
});

browser.menus.onClicked.addListener(async info => {
    if (info.parentMenuItemId === menuIdWhitelist) {
        const pattern = whitelistChildMenuPatterns.get(info.menuItemId);
        const whitelist = await options.get("userAgentWhitelist");

        // Add to whitelist and update options
        whitelist.push(pattern);
        await options.set("userAgentWhitelist", whitelist);
    }
});

browser.menus.onShown.addListener(async info => {
    // Only rebuild menus if whitelist menu present
    // WebExt typings are broken again here, so ugly casting
    const menuIds = info.menuIds as unknown as number[];
    if (menuIds.includes(menuIdWhitelist as number)) {
        return;
    }


    /**
     * If page URL doesn't exist, we're not on a page and have
     * nothing to whitelist, so disable the menu and return.
     */
    if (!info.pageUrl) {
        browser.menus.update(menuIdWhitelist, {
            enabled: false
        });

        browser.menus.refresh();
        return;
    }


    const url = new URL(info.pageUrl);
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


    for (const [ menuId ] of whitelistChildMenuPatterns) {
        // Clear all page-specific temporary menus
        if (menuId !== menuIdWhitelistRecommended) {
            browser.menus.remove(menuId);
        }

        whitelistChildMenuPatterns.delete(menuId);
    }


    // If there is more than one subdomain, get the base domain
    const baseDomain = (url.host.match(/\./g) || []).length > 1
        ? url.host.substring(url.host.indexOf(".") + 1)
        : url.host;

    const patternRecommended = `${url.origin}/*`;
    const patternSearch = `${url.origin}${url.pathname}${url.search}`;
    const patternWildcardProtocol = `*://${url.host}/*`;
    const patternWildcardSubdomain = `${url.protocol}//*.${baseDomain}/*`;
    const patternWildcardProtocolAndSubdomain = `*://*.${baseDomain}/*`;


    // Update recommended menu item
    browser.menus.update(menuIdWhitelistRecommended, {
        title: _("contextAddToWhitelistRecommended", patternRecommended)
    });

    whitelistChildMenuPatterns.set(
            menuIdWhitelistRecommended, patternRecommended);


    if (url.search) {
        const whitelistSearchMenuId = await browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd", patternSearch)
          , parentId: menuIdWhitelist
        });

        whitelistChildMenuPatterns.set(
                whitelistSearchMenuId, patternSearch);
    }


    /**
     * Split URL path into segments and add menu items for each
     * partial path as the segments are removed.
     */
    {
        const pathTrimmed = url.pathname.endsWith("/")
            ? url.pathname.substring(0, url.pathname.length - 1)
            : url.pathname;

        const pathSegments = pathTrimmed.split("/")
                .filter(segment => segment)
                .reverse();

        if (pathSegments.length) {
            let index = 0;

            for (const pathSegment of pathSegments) {
                const partialPath = pathSegments
                        .slice(index)
                        .reverse()
                        .join("/");

                const pattern = `${url.origin}/${partialPath}/*`;

                const partialPathMenuId = await browser.menus.create({
                    title: _("contextAddToWhitelistAdvancedAdd", pattern)
                  , parentId: menuIdWhitelist
                });

                whitelistChildMenuPatterns.set(
                        partialPathMenuId, pattern);

                index++;
            }
        }
    }


    const wildcardProtocolMenuId = await browser.menus.create({
        title: _("contextAddToWhitelistAdvancedAdd"
              , patternWildcardProtocol)
      , parentId: menuIdWhitelist
    });

    whitelistChildMenuPatterns.set(
            wildcardProtocolMenuId, patternWildcardProtocol);


    const wildcardSubdomainMenuId = await browser.menus.create({
        title: _("contextAddToWhitelistAdvancedAdd"
              , patternWildcardSubdomain)
      , parentId: menuIdWhitelist
    });

    whitelistChildMenuPatterns.set(
            wildcardSubdomainMenuId, patternWildcardSubdomain);


    const wildcardProtocolAndSubdomainMenuId = await browser.menus.create({
        title: _("contextAddToWhitelistAdvancedAdd"
              , patternWildcardProtocolAndSubdomain)
      , parentId: menuIdWhitelist
    });

    whitelistChildMenuPatterns.set(
            wildcardProtocolAndSubdomainMenuId
          , patternWildcardProtocolAndSubdomain);


    await browser.menus.refresh();
});
