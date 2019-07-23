"use strict";

import options from "../lib/options";
import { TypedEventTarget } from "../lib/typedEvents";


const _ = browser.i18n.getMessage;


const URL_PATTERN_HTTP = "http://*/*";
const URL_PATTERN_HTTPS = "http://*/*";
const URL_PATTERN_FILE = "file://*/*";


type MenuId = string | number;

type OnShownData = Parameters<Parameters<
        typeof browser.menus.onShown.addListener>[0]>[0];


interface MenuManagerClickedData {
    info: browser.menus.OnClickData;
    tab: browser.tabs.Tab;
}

interface MenuManagerEvents {
    "mirrorCastMenuClicked": MenuManagerClickedData;
    "mediaCastMenuClicked": MenuManagerClickedData;
}

class MenuManager extends TypedEventTarget<MenuManagerEvents> {
    public mirrorCastMenuId: MenuId;
    public mediaCastMenuId: MenuId;

    private whitelistMenuId: MenuId;
    private whitelistRecommendedMenuId: MenuId;

    private whitelistChildMenuPatterns = new Map<MenuId, string>();

    constructor () {
        super();

        this.onMenuClicked = this.onMenuClicked.bind(this);
        this.onMenuShown = this.onMenuShown.bind(this);

        browser.menus.onClicked.addListener(this.onMenuClicked);
        browser.menus.onShown.addListener(this.onMenuShown);
    }

    public set isLocalMediaEnabled (state: boolean) {
        browser.menus.update(this.mediaCastMenuId, {
            targetUrlPatterns: state
                ? [ URL_PATTERN_HTTP, URL_PATTERN_HTTPS ]
                : [ URL_PATTERN_HTTP, URL_PATTERN_HTTPS, URL_PATTERN_FILE ]
        });
    }

    public async createMenus () {
        // Only create menus once
        if (this.mirrorCastMenuId
         || this.mediaCastMenuId
         || this.whitelistMenuId
         || this.whitelistRecommendedMenuId) {
            return;
        }

        const opts = await options.getAll();

        // <video>/<audio> "Cast..." context menu item
        this.mediaCastMenuId = await browser.menus.create({
            contexts: [ "audio", "video" ]
          , title: _("contextCast")
          , visible: opts.mediaEnabled
        });

        this.isLocalMediaEnabled = opts.localMediaEnabled;

        // Screen/Tab mirroring "Cast..." context menu item
        this.mirrorCastMenuId = await browser.menus.create({
            contexts: [ "browser_action", "page", "tools_menu" ]
          , title: _("contextCast")
          , visible: opts.mirroringEnabled

            // Mirroring doesn't work from file:// urls
          , documentUrlPatterns: [
                URL_PATTERN_HTTP
              , URL_PATTERN_HTTPS
            ]
        });


        this.whitelistMenuId = await browser.menus.create({
            contexts: [ "browser_action" ]
          , title: _("contextAddToWhitelist")
          , enabled: false
        });

        this.whitelistRecommendedMenuId = await browser.menus.create({
            title: _("contextAddToWhitelistRecommended")
          , parentId: this.whitelistMenuId
        });

        await browser.menus.create({
            type: "separator"
          , parentId: this.whitelistMenuId
        });
    }

    private async onMenuClicked (
            info: browser.menus.OnClickData
          , tab: browser.tabs.Tab) {

        const { menuItemId } = info;

        switch (menuItemId) {
            case this.mirrorCastMenuId: {
                this.dispatchEvent(new CustomEvent("mirrorCastMenuClicked", {
                    detail: { info, tab }
                }));
                break;
            }

            case this.mediaCastMenuId: {
                this.dispatchEvent(new CustomEvent("mediaCastMenuClicked", {
                    detail: { info, tab }
                }));
                break;
            }
        }

        if (info.parentMenuItemId === this.whitelistMenuId) {
            const pattern = this.whitelistChildMenuPatterns.get(menuItemId);
            const whitelist = await options.get("userAgentWhitelist");

            // Add to whitelist and update options
            whitelist.push(pattern);
            await options.set("userAgentWhitelist", whitelist);
        }
    }

    private async onMenuShown (info: OnShownData) {
        // Only rebuild menus if whitelist menu present
        // WebExt typings are broken again here, so ugly casting
        const menuIds = info.menuIds as unknown as number[];
        if (menuIds.includes(this.whitelistMenuId as number)) {
            return;
        }


        /**
         * If page URL doesn't exist, we're not on a page and have
         * nothing to whitelist, so disable the menu and return.
         */
        if (!info.pageUrl) {
            browser.menus.update(this.whitelistMenuId, {
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
            browser.menus.update(this.whitelistMenuId, {
                enabled: false
            });

            browser.menus.refresh();
            return;
        }


        // Enable the whitelist menu
        browser.menus.update(this.whitelistMenuId, {
            enabled: true
        });


        for (const [ menuId ] of this.whitelistChildMenuPatterns) {
            // Clear all page-specific temporary menus
            if (menuId !== this.whitelistRecommendedMenuId) {
                browser.menus.remove(menuId);
            }

            this.whitelistChildMenuPatterns.delete(menuId);
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
        browser.menus.update(this.whitelistRecommendedMenuId, {
            title: _("contextAddToWhitelistRecommended", patternRecommended)
        });

        this.whitelistChildMenuPatterns.set(
                this.whitelistRecommendedMenuId, patternRecommended);


        if (url.search) {
            const whitelistSearchMenuId = await browser.menus.create({
                title: _("contextAddToWhitelistAdvancedAdd", patternSearch)
              , parentId: this.whitelistMenuId
            });

            this.whitelistChildMenuPatterns.set(
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
                      , parentId: this.whitelistMenuId
                    });

                    this.whitelistChildMenuPatterns.set(
                            partialPathMenuId, pattern);

                    index++;
                }
            }
        }


        const wildcardProtocolMenuId = await browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd"
                  , patternWildcardProtocol)
          , parentId: this.whitelistMenuId
        });

        this.whitelistChildMenuPatterns.set(
                wildcardProtocolMenuId, patternWildcardProtocol);


        const wildcardSubdomainMenuId = await browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd"
                  , patternWildcardSubdomain)
          , parentId: this.whitelistMenuId
        });

        this.whitelistChildMenuPatterns.set(
                wildcardSubdomainMenuId, patternWildcardSubdomain);


        const wildcardProtocolAndSubdomainMenuId = await browser.menus.create({
            title: _("contextAddToWhitelistAdvancedAdd"
                  , patternWildcardProtocolAndSubdomain)
          , parentId: this.whitelistMenuId
        });

        this.whitelistChildMenuPatterns.set(
                wildcardProtocolAndSubdomainMenuId
              , patternWildcardProtocolAndSubdomain);


        await browser.menus.refresh();
    }
}

export default new MenuManager();
