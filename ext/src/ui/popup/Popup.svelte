<script lang="ts">
    import { afterUpdate, onMount, tick } from "svelte";

    import messaging, { Message, Port } from "../../messaging";
    import options, { Options } from "../../lib/options";
    import { RemoteMatchPattern } from "../../lib/matchPattern";

    import {
        ReceiverDevice,
        ReceiverSelectionActionType,
        ReceiverSelectorMediaType,
        ReceiverSelectorPageInfo
    } from "../../types";

    import knownApps, { KnownApp } from "../../cast/knownApps";
    import { hasRequiredCapabilities } from "../../cast/utils";

    import Receiver from "./Receiver.svelte";
    import deviceStore from "./deviceStore";

    const _ = browser.i18n.getMessage;

    /** Currently selected media type. */
    let mediaType = ReceiverSelectorMediaType.App;
    /** Media types available to select. */
    let availableMediaTypes = ReceiverSelectorMediaType.App;

    /** Sender app ID (if available). */
    let appId: Optional<string>;
    /** Page info (if launched from page context). */
    let pageInfo: Optional<ReceiverSelectorPageInfo>;

    /** App details (if matches known app). */
    let knownApp: Nullable<KnownApp> = null;

    /** Whether current page URL matches a whitelist pattern. */
    let isPageWhitelisted = false;

    /** Whether casting to a device been initiated from this selector. */
    let isConnecting = false;

    /** Extension options */
    let opts: Nullable<Options> = null;

    $: isMediaTypeAvailable = !!(availableMediaTypes & mediaType);
    $: isAppMediaTypeAvailable = !!(
        availableMediaTypes & ReceiverSelectorMediaType.App
    );

    /** Whether to display whitelist suggestion banner. */
    $: shouldSuggestWhitelist =
        // If we know the app
        knownApp &&
        // If the whitelist is enabled
        opts?.siteWhitelistEnabled &&
        // If the page is not whitelisted
        !isPageWhitelisted &&
        // If an app is not already loaded on the page
        !(availableMediaTypes & ReceiverSelectorMediaType.App);

    let port: Nullable<Port> = null;
    let browserWindow: Nullable<browser.windows.Window> = null;
    let resizeObserver = new ResizeObserver(() => fitWindowHeight());

    window.addEventListener("resize", fitWindowHeight);

    onMount(async () => {
        port = messaging.connect({ name: "popup" });
        port.onMessage.addListener(onMessage);

        browserWindow = await browser.windows.getCurrent();

        opts = await options.getAll();
        options.addEventListener("changed", async ev => {
            opts = await options.getAll();

            /**
             * Update available media types and ensure selected media
             * type is valid.
             */
            if (ev.detail.includes("mirroringEnabled")) {
                const mirroringMediaTypes =
                    ReceiverSelectorMediaType.Tab |
                    ReceiverSelectorMediaType.Screen;

                if (!opts.mirroringEnabled) {
                    availableMediaTypes &= ~mirroringMediaTypes;
                } else {
                    availableMediaTypes |= mirroringMediaTypes;
                }

                if (!(availableMediaTypes & mediaType)) {
                    if (availableMediaTypes & ReceiverSelectorMediaType.App) {
                        mediaType = ReceiverSelectorMediaType.App;
                    } else if (
                        availableMediaTypes & ReceiverSelectorMediaType.Tab
                    ) {
                        mediaType = ReceiverSelectorMediaType.Tab;
                    } else {
                        mediaType = ReceiverSelectorMediaType.App;
                    }
                }
            }
        });

        updateKnownApp();

        resizeObserver.observe(document.documentElement);

        window.addEventListener("contextmenu", onContextMenu);
        browser.menus.onClicked.addListener(onMenuClicked);
        browser.menus.onShown.addListener(onMenuShown);

        return () => {
            port?.disconnect();
            resizeObserver.disconnect();

            window.addEventListener("contextmenu", onContextMenu);
            browser.menus.onClicked.removeListener(onMenuClicked);
            browser.menus.onShown.removeListener(onMenuShown);
        };
    });

    afterUpdate(async () => {
        await tick();
        fitWindowHeight();
    });

    function onMessage(message: Message) {
        switch (message.subject) {
            case "popup:init":
                appId = message.data.appId;
                pageInfo = message.data.pageInfo;
                break;

            case "popup:close":
                window.close();
                break;

            case "popup:update": {
                /**
                 * Filter receiver devices without the required
                 * capabilities.
                 */
                $deviceStore = message.data.receiverDevices.filter(device =>
                    hasRequiredCapabilities(
                        device,
                        pageInfo?.sessionRequest?.capabilities
                    )
                );

                if (
                    message.data.availableMediaTypes !== undefined &&
                    message.data.defaultMediaType !== undefined
                ) {
                    availableMediaTypes = message.data.availableMediaTypes;

                    if (availableMediaTypes & message.data.defaultMediaType) {
                        mediaType = message.data.defaultMediaType;
                    }
                }

                updateKnownApp();
                break;
            }
        }
    }

    /** Resize browser window to fit content height. */
    function fitWindowHeight() {
        if (browserWindow?.id === undefined) return;
        browser.windows.update(browserWindow.id, {
            height: Math.ceil(
                document.body.clientHeight +
                    (window.outerHeight - window.innerHeight)
            )
        });
    }

    function updateKnownApp() {
        let newKnownApp: Nullable<KnownApp> = null;

        /**
         * Check knownApps for an app with an ID matching the registered
         * app on the target page.
         */
        if (isAppMediaTypeAvailable && appId) {
            newKnownApp = knownApps[appId];
        } else if (pageInfo) {
            const pageUrl = pageInfo.url;

            /**
             * Or if there isn't an registered app, check for an app
             * with a match pattern matching the target page URL.
             */
            for (const [, app] of Object.entries(knownApps)) {
                if (!app.matches) {
                    continue;
                }

                const pattern = new RemoteMatchPattern(app.matches);
                if (pattern.matches(pageUrl)) {
                    newKnownApp = app;
                    break;
                }
            }
        }

        // Check if target page URL is whitelisted.
        if (pageInfo && opts?.siteWhitelist) {
            for (const item of opts.siteWhitelist) {
                const pattern = new RemoteMatchPattern(item.pattern);
                if (pattern.matches(pageInfo.url)) {
                    isPageWhitelisted = true;
                    break;
                }
            }
        }

        knownApp = newKnownApp;
    }

    async function addToWhitelist(
        app: KnownApp,
        pageInfo: ReceiverSelectorPageInfo
    ) {
        if (!app.matches) {
            return;
        }

        const whitelist = await options.get("siteWhitelist");
        if (!whitelist.find(item => item.pattern === app.matches)) {
            whitelist.push({ pattern: app.matches, isEnabled: true });
            await options.set("siteWhitelist", whitelist);

            await browser.tabs.reload(pageInfo.tabId);
            window.close();
        }
    }

    function onContextMenu(ev: MouseEvent) {
        if (!(ev.target instanceof Element)) return;

        const receiverElement = ev.target.closest(".receiver");
        if (receiverElement) {
            browser.menus.overrideContext({
                showDefaults: false
            });
        }
    }

    function getDeviceFromElement(target: Element) {
        const receiverElement = target.closest(".receiver");
        if (!receiverElement) return;

        const receiverElementIndex = [
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            ...receiverElement.parentElement!.children
        ].indexOf(receiverElement);

        // Match by index rendered receiver element to device array
        if (receiverElementIndex > -1) {
            return $deviceStore[receiverElementIndex];
        }
    }

    /** Handle show events for receiver context menus. */
    function onMenuShown(info: browser.menus._OnShownInfo) {
        if (!info.targetElementId) return;
        const target = browser.menus.getTargetElement(info.targetElementId);
        if (!target) return;

        const device = getDeviceFromElement(target);
        if (!device) {
            browser.menus.update("popup_cast", { visible: false });
            browser.menus.update("popup_stop", { visible: false });
        } else {
            const app = device.status?.applications?.[0];
            const isAppRunning = !!(app && !app.isIdleScreen);

            browser.menus.update("popup_cast", {
                visible: true,
                title: _("popupCastMenuTitle", device.friendlyName),
                enabled:
                    // Not already connecting to a receiver
                    !isConnecting &&
                    // Selected media type available
                    isMediaTypeAvailable
            });

            browser.menus.update("popup_stop", {
                visible: isAppRunning,
                title: isAppRunning
                    ? _("popupStopMenuTitle", [
                          app.displayName,
                          device.friendlyName
                      ])
                    : ""
            });
        }

        browser.menus.refresh();
    }

    /** Handle click events for receiver context menus. */
    function onMenuClicked(info: browser.menus.OnClickData) {
        if (
            info.menuItemId !== "popup_cast" &&
            info.menuItemId !== "popup_stop"
        ) {
            return;
        }

        if (!info.targetElementId) return;
        const target = browser.menus.getTargetElement(info.targetElementId);
        if (!target) return;

        const device = getDeviceFromElement(target);
        if (!device) return;

        switch (info.menuItemId) {
            case "popup_cast":
                onReceiverCast(device);
                break;
            case "popup_stop":
                onReceiverStop(device);
                break;
        }
    }

    function onReceiverCast(receiverDevice: ReceiverDevice) {
        isConnecting = true;

        port?.postMessage({
            subject: "receiverSelector:selected",
            data: {
                receiverDevice,
                actionType: ReceiverSelectionActionType.Cast,
                mediaType
            }
        });
    }

    function onReceiverStop(receiverDevice: ReceiverDevice) {
        port?.postMessage({
            subject: "receiverSelector:stop",
            data: {
                receiverDevice,
                actionType: ReceiverSelectionActionType.Stop
            }
        });
    }
</script>

<div class="whitelist-banner" hidden={!shouldSuggestWhitelist}>
    <img src="photon_info.svg" alt="icon, info" />
    {_("popupWhitelistNotWhitelisted", knownApp?.name)}
    <button
        on:click={() => {
            if (!knownApp || !pageInfo) return;
            addToWhitelist(knownApp, pageInfo);
        }}
    >
        {_("popupWhitelistAddToWhitelist")}
    </button>
</div>

{#if availableMediaTypes !== ReceiverSelectorMediaType.None}
    <div class="media-type-select">
        <div class="media-type-select__label-cast">
            {_("popupMediaSelectCastLabel")}
        </div>
        <div class="select-wrapper">
            <select class="media-type-select__dropdown" bind:value={mediaType}>
                <option
                    value={ReceiverSelectorMediaType.App}
                    disabled={!isAppMediaTypeAvailable}
                >
                    {knownApp?.name ?? _("popupMediaTypeApp")}
                </option>

                {#if opts?.mirroringEnabled}
                    <option
                        value={ReceiverSelectorMediaType.Tab}
                        disabled={!(
                            availableMediaTypes & ReceiverSelectorMediaType.Tab
                        )}
                    >
                        {_("popupMediaTypeTab")}
                    </option>
                    <option
                        value={ReceiverSelectorMediaType.Screen}
                        disabled={!(
                            availableMediaTypes &
                            ReceiverSelectorMediaType.Screen
                        )}
                    >
                        {_("popupMediaTypeScreen")}
                    </option>
                {/if}
            </select>
        </div>
        <div class="media-type-select__label-to">
            {_("popupMediaSelectToLabel")}
        </div>
    </div>
{/if}

<ul class="receiver-list">
    {#if !$deviceStore.length}
        <div class="receiver-list__not-found">
            {_("popupNoReceiversFound")}
        </div>
    {:else}
        {#each $deviceStore as device}
            <Receiver
                {port}
                {device}
                {isMediaTypeAvailable}
                isAnyMediaTypeAvailable={availableMediaTypes !==
                    ReceiverSelectorMediaType.None}
                isAnyConnecting={isConnecting}
                on:cast={ev => onReceiverCast(ev.detail.device)}
                on:stop={ev => onReceiverStop(ev.detail.device)}
            />
        {/each}
    {/if}
</ul>
