<script lang="ts">
    import { afterUpdate, onDestroy, onMount, tick } from "svelte";

    import messaging, { Message, Port } from "../../messaging";
    import options, { Options } from "../../lib/options";
    import { RemoteMatchPattern } from "../../lib/matchPattern";

    import { receiverMenuIds } from "../../menuIds";

    import {
        ReceiverDevice,
        ReceiverDeviceCapabilities,
        ReceiverSelectorAppInfo,
        ReceiverSelectorMediaType,
        ReceiverSelectorPageInfo
    } from "../../types";

    import knownApps, { KnownApp } from "../../cast/knownApps";
    import { hasRequiredCapabilities } from "../../cast/utils";

    import Receiver from "./Receiver.svelte";

    const _ = browser.i18n.getMessage;

    /** Currently selected media type. */
    let mediaType = ReceiverSelectorMediaType.App;
    /** Media types available to select. */
    let availableMediaTypes = ReceiverSelectorMediaType.App;

    /** Whether to show bridge warning banner. */
    let isBridgeCompatible = true;

    /** Devices to display. */
    let devices: ReceiverDevice[] = [];
    /** IDs of sessions connected by this extension. */
    let connectedSessionIds: string[] = [];

    /** Sender app info (if available). */
    let appInfo: Optional<ReceiverSelectorAppInfo>;
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

    /**
     * Checks if device is compatible with the requested app and
     * capabilities.
     */
    function isDeviceCompatible(
        mediaType: ReceiverSelectorMediaType,
        device: ReceiverDevice
    ) {
        switch (mediaType) {
            case ReceiverSelectorMediaType.App:
                // If device is audio-only, check app's audio support flag
                if (
                    !(
                        device.capabilities &
                        ReceiverDeviceCapabilities.VIDEO_OUT
                    ) &&
                    appInfo?.isRequestAppAudioCompatible === false
                ) {
                    return false;
                }

                return hasRequiredCapabilities(
                    device,
                    appInfo?.sessionRequest?.capabilities
                );

            /** Mirroring requires video output capability. */
            case ReceiverSelectorMediaType.Tab:
            case ReceiverSelectorMediaType.Screen:
                return !!(
                    device.capabilities & ReceiverDeviceCapabilities.VIDEO_OUT
                );
        }

        return false;
    }

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

        browser.menus.onShown.addListener(onMenuShown);
    });

    onDestroy(() => {
        port?.disconnect();
        resizeObserver.disconnect();

        browser.menus.onShown.removeListener(onMenuShown);
    });

    afterUpdate(async () => {
        await tick();
        fitWindowHeight();
    });

    function onMessage(message: Message) {
        switch (message.subject) {
            case "popup:init":
                appInfo = message.data.appInfo;
                pageInfo = message.data.pageInfo;
                isBridgeCompatible = message.data.isBridgeCompatible;
                break;

            case "popup:update": {
                updateKnownApp();

                if (
                    message.data.availableMediaTypes !== undefined &&
                    message.data.defaultMediaType !== undefined
                ) {
                    availableMediaTypes = message.data.availableMediaTypes;

                    if (availableMediaTypes & message.data.defaultMediaType) {
                        mediaType = message.data.defaultMediaType;
                    }
                }

                devices = message.data.devices;

                if (message.data.connectedSessionIds) {
                    connectedSessionIds = message.data.connectedSessionIds;
                }

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
        if (isAppMediaTypeAvailable && appInfo?.sessionRequest.appId) {
            newKnownApp = knownApps[appInfo.sessionRequest.appId];
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

    /** Device ID associated with the last receiver menu that was shown. */
    let lastMenuShownDeviceId: string;

    /** Handle show events for receiver context menus. */
    function onMenuShown(info: browser.menus._OnShownInfo) {
        // Only handle menu events on this page
        if (info.pageUrl !== window.location.href) return;

        if (!info.targetElementId) return;
        const targetElement = browser.menus.getTargetElement(
            info.targetElementId
        );
        if (!targetElement) return;

        const receiverElement = targetElement.closest(".receiver");
        if (!receiverElement) {
            for (const menuId of receiverMenuIds) {
                browser.menus.update(menuId, { visible: false });
            }

            browser.menus.refresh();
        }
    }

    function onReceiverCast(device: ReceiverDevice) {
        isConnecting = true;

        port?.postMessage({
            subject: "main:receiverSelected",
            data: { device, mediaType }
        });
    }

    function onReceiverStop(device: ReceiverDevice) {
        port?.postMessage({
            subject: "main:sendReceiverMessage",
            data: {
                deviceId: device.id,
                message: { requestId: 0, type: "STOP" }
            }
        });

        port?.postMessage({
            subject: "main:receiverStopped",
            data: { deviceId: device.id }
        });
    }
</script>

{#if !isBridgeCompatible}
    <div class="banner banner--warn">
        {_("popupBridgeErrorBanner")}
        <button
            on:click={() => {
                browser.runtime.openOptionsPage();
            }}
        >
            {_("popupBridgeErrorBannerOptions")}
        </button>
    </div>
{/if}

{#if shouldSuggestWhitelist}
    <div class="banner banner--info">
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
{/if}

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
    {#if !devices.length}
        <div class="receiver-list__not-found">
            {_("popupNoReceiversFound")}
        </div>
    {:else}
        {#each devices as device}
            <Receiver
                {opts}
                {port}
                {device}
                {connectedSessionIds}
                {isMediaTypeAvailable}
                isAnyMediaTypeAvailable={availableMediaTypes !==
                    ReceiverSelectorMediaType.None &&
                    isDeviceCompatible(mediaType, device)}
                isAnyConnecting={isConnecting}
                bind:lastMenuShownDeviceId
                on:cast={ev => onReceiverCast(ev.detail.device)}
                on:stop={ev => onReceiverStop(ev.detail.device)}
            />
        {/each}
    {/if}
</ul>
