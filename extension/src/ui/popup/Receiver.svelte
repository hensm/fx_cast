<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import fuzzysort from "fuzzysort";

    import type { Options } from "../../lib/options";

    import {
        type ReceiverDevice,
        ReceiverDeviceCapabilities
    } from "../../types";
    import type { Port } from "../../messaging";

    import { MenuId } from "../../menuIds";

    import type { Volume } from "../../cast/sdk/classes";
    import { PlayerState, TrackType } from "../../cast/sdk/media/enums";
    import type {
        SenderMediaMessage,
        SenderMessage
    } from "../../cast/sdk/types";
    import { _MediaCommand } from "../../cast/sdk/types";

    import LoadingIndicator from "../LoadingIndicator.svelte";
    import ReceiverMedia from "./ReceiverMedia.svelte";

    const _ = browser.i18n.getMessage;

    const dispatch = createEventDispatcher<{
        cast: { device: ReceiverDevice };
        stop: { device: ReceiverDevice };
    }>();

    export let port: Nullable<Port>;

    /** Whether there are sessions being established for any receiver. */
    export let isAnyConnecting: boolean;
    /** Whether the selected media type is available for this receiver. */
    export let isMediaTypeAvailable: boolean;
    /** Whether any media types are available for this receiver. */
    export let isAnyMediaTypeAvailable: boolean;

    /** Device to display. */
    export let device: ReceiverDevice;
    export let connectedSessionIds: string[];

    /** Result object if this receiver is displayed in a search results list. */
    export let result: Nullable<Fuzzysort.KeyResult<ReceiverDevice>> = null;

    export let opts: Nullable<Options>;

    /** Current receiver application (if available) */
    $: application = device.status?.applications?.[0];
    /** Current media status (if available) */
    $: mediaStatus = device.mediaStatus;

    export let lastMenuShownDeviceId: string;
    $: if (lastMenuShownDeviceId === device.id) {
        void device.mediaStatus;
        updateMediaMenus();
        browser.menus.refresh();
    }

    const languageNames = new Intl.DisplayNames(
        [browser.i18n.getUILanguage()],
        { type: "language" }
    );

    // Subtitle/caption tracks
    $: textTracks = mediaStatus?.media?.tracks
        ?.filter(track => track.type === TrackType.TEXT)
        .map(track => {
            /**
             * If track has no name, but does have a language, get a
             * display name for the language.
             */
            if (!track.name && track.language) {
                try {
                    const displayName = languageNames.of(track.language);
                    if (displayName) {
                        track.name = displayName;
                    }
                    // eslint-disable-next-line no-empty
                } catch (err) {}
            }

            return track;
        });
    $: activeTextTrackId = mediaStatus?.activeTrackIds?.find(trackId =>
        textTracks?.find(track => track.trackId === trackId)
    );

    /** Whether media controls are shown. */
    let isExpanded = false;
    let isExpandedUserModified = false;

    // Unexpand if media status disappears
    $: if (!device.mediaStatus) {
        isExpanded = false;
    } else if (
        // If app is running
        application &&
        // And user hasn't manually changed the expanded state
        !isExpandedUserModified &&
        // And auto-expansion is enabled
        opts?.receiverSelectorExpandActive
    ) {
        isExpanded = connectedSessionIds.includes(application.transportId);
    }

    /** Whether a session request is in progress for this receiver.. */
    let isConnecting = false;

    function sendReceiverMessage(
        partialMessage: DistributiveOmit<SenderMessage, "requestId">
    ) {
        const message: SenderMessage = {
            ...partialMessage,
            requestId: 0
        };

        port?.postMessage({
            subject: "main:sendReceiverMessage",
            data: { deviceId: device.id, message }
        });
    }
    function sendMediaMessage(
        partialMessage: DistributiveOmit<
            SenderMediaMessage,
            "requestId" | "mediaSessionId"
        >
    ) {
        if (!device.mediaStatus) return;

        const message: SenderMediaMessage = {
            ...(partialMessage as any),
            requestId: 0,
            mediaSessionId: device.mediaStatus.mediaSessionId
        };

        port?.postMessage({
            subject: "main:sendMediaMessage",
            data: { deviceId: device.id, message }
        });
    }

    let receiverElement: HTMLLIElement;
    function isTarget(
        info?: browser.menus._OnShownInfo | browser.menus.OnClickData
    ) {
        // Only handle menu events on this page
        if (info?.pageUrl !== window.location.href) return false;

        if (!info.targetElementId) return false;
        const targetElement = browser.menus.getTargetElement(
            info.targetElementId
        );
        if (!targetElement) return false;

        return (
            targetElement === receiverElement ||
            receiverElement.contains(targetElement)
        );
    }

    // Map of menu IDs to track IDs
    const captionSubmenus = new Map<number | string, number>();

    function onMenuShown(info: browser.menus._OnShownInfo) {
        if (!isTarget(info)) {
            return;
        }

        lastMenuShownDeviceId = device.id;

        browser.menus.update(MenuId.PopupCast, {
            visible: true,
            title: _("popupCastMenuTitle", device.friendlyName),
            enabled:
                // Not already connecting to a receiver
                !isConnecting &&
                !isAnyConnecting &&
                // Selected media type available
                isMediaTypeAvailable &&
                isAnyMediaTypeAvailable
        });

        browser.menus.update(MenuId.PopupStop, {
            visible: !!application && !application.isIdleScreen,
            title: application?.displayName
                ? _("popupStopMenuTitle", [
                      application.displayName,
                      device.friendlyName
                  ])
                : ""
        });

        updateMediaMenus(info.menuIds as (string | number)[]);
        browser.menus.refresh();
    }

    function handleMediaPlayPause() {
        switch (mediaStatus?.playerState) {
            case PlayerState.PLAYING:
                sendMediaMessage({ type: "PAUSE" });
                break;
            case PlayerState.PAUSED:
                sendMediaMessage({ type: "PLAY" });
                break;
        }
    }
    function handleMediaSkipPrevious() {
        sendMediaMessage({
            type: "QUEUE_UPDATE",
            jump: -1
        });
    }
    function handleMediaSkipNext() {
        sendMediaMessage({
            type: "QUEUE_UPDATE",
            jump: 1
        });
    }
    function handleMediaTrackChange(activeTrackIds: number[]) {
        sendMediaMessage({
            type: "EDIT_TRACKS_INFO",
            activeTrackIds: activeTrackIds
        });
    }
    function handleVolumeChange(volume: Partial<Volume>) {
        sendReceiverMessage({
            type: "SET_VOLUME",
            volume
        });
    }

    function onMenuClicked(info: browser.menus.OnClickData) {
        if (!isTarget(info)) return;

        switch (info.menuItemId) {
            case MenuId.PopupMediaPlayPause:
                handleMediaPlayPause();
                break;
            case MenuId.PopupMediaMute:
                if (
                    !device.status?.volume.muted &&
                    device.status?.volume.level === 0
                ) {
                    handleVolumeChange({ level: 1 });
                } else {
                    handleVolumeChange({ muted: !device.status?.volume.muted });
                }
                break;
            case MenuId.PopupMediaSkipPrevious:
                handleMediaSkipPrevious();
                break;
            case MenuId.PopupMediaSkipNext:
                handleMediaSkipNext();
                break;

            case MenuId.PopupCast:
                isConnecting = true;
                dispatch("cast", { device });
                break;
            case MenuId.PopupStop:
                dispatch("stop", { device });
                break;
        }

        // Handle caption submenu items
        if (info.parentMenuItemId === MenuId.PopupMediaCaptions) {
            // Filter and append active track IDs array
            if (!mediaStatus?.activeTrackIds) return;
            const activeTrackIds = mediaStatus.activeTrackIds.filter(
                activeTrackId => activeTrackId !== activeTextTrackId
            );

            const trackId = captionSubmenus.get(info.menuItemId);
            if (trackId) {
                activeTrackIds.push(trackId);
            }

            handleMediaTrackChange(activeTrackIds);
        }
    }

    function onContextMenu() {
        browser.menus.overrideContext({ showDefaults: false });
    }

    const mediaMenuIds = [
        MenuId.PopupMediaSeparator,
        MenuId.PopupMediaPlayPause,
        MenuId.PopupMediaMute,
        MenuId.PopupMediaSkipPrevious,
        MenuId.PopupMediaSkipNext,
        MenuId.PopupMediaCaptions
    ];

    /** Updates media menu items from media status. */
    function updateMediaMenus(shownMenuIds: (number | string)[] = []) {
        // Clear caption submenu for re-build
        if (captionSubmenus.size) {
            for (const menuId of captionSubmenus.keys()) {
                browser.menus.remove(menuId);
            }
            captionSubmenus.clear();
        } else {
            // Clear caption submenus from previous instances
            for (const menuId of shownMenuIds as string[] | number[]) {
                if (
                    typeof menuId === "string" &&
                    menuId.startsWith("subtitle-")
                ) {
                    browser.menus.remove(menuId);
                }
            }
        }

        // Hide all media menu items if no media status
        if (!mediaStatus) {
            for (const menuId of mediaMenuIds)
                browser.menus.update(menuId, { visible: false });
            return;
        }

        browser.menus.update(MenuId.PopupMediaSeparator, {
            visible: true
        });

        // Play/pause menu item
        if (mediaStatus.supportedMediaCommands & _MediaCommand.PAUSE) {
            browser.menus.update(MenuId.PopupMediaPlayPause, {
                visible: true,
                title:
                    mediaStatus.playerState === PlayerState.PLAYING ||
                    mediaStatus.playerState === PlayerState.BUFFERING
                        ? _("popupMediaPause")
                        : _("popupMediaPlay"),
                enabled:
                    mediaStatus.playerState === PlayerState.PLAYING ||
                    mediaStatus.playerState === PlayerState.PAUSED
            });
        } else {
            browser.menus.update(MenuId.PopupMediaPlayPause, {
                visible: false
            });
        }

        // Mute/unmute menu item
        if (device.status?.volume) {
            const volume = device.status.volume;

            browser.menus.update(MenuId.PopupMediaMute, {
                visible: true,
                title: _("popupMediaMute"),
                checked: volume.muted || volume.level === 0,
                enabled: "muted" in volume
            });
        } else {
            browser.menus.update(MenuId.PopupMediaMute, {
                visible: false
            });
        }

        browser.menus.update(MenuId.PopupMediaSkipPrevious, {
            visible: !!(
                mediaStatus.supportedMediaCommands & _MediaCommand.QUEUE_PREV
            )
        });
        browser.menus.update(MenuId.PopupMediaSkipNext, {
            visible: !!(
                mediaStatus.supportedMediaCommands & _MediaCommand.QUEUE_NEXT
            )
        });

        // Build captions submenu from text tracks
        if (
            textTracks?.length &&
            mediaStatus.supportedMediaCommands & _MediaCommand.EDIT_TRACKS
        ) {
            browser.menus.update(MenuId.PopupMediaCaptions, { visible: true });
            browser.menus.update(MenuId.PopupMediaCaptionsOff, {
                visible: true,
                checked: activeTextTrackId === undefined
            });

            for (const track of textTracks) {
                const menuId = browser.menus.create({
                    id: `subtitle-${track.trackId}`,
                    title: track.name ?? track.trackId.toString(),
                    parentId: MenuId.PopupMediaCaptions,
                    type: "radio",
                    checked: track.trackId === activeTextTrackId
                });

                captionSubmenus.set(menuId, track.trackId);
            }
        } else {
            browser.menus.update(MenuId.PopupMediaCaptions, {
                visible: false
            });
        }
    }

    onMount(() => {
        sendMediaMessage({
            type: "GET_STATUS"
        });

        browser.menus.onShown.addListener(onMenuShown);
        browser.menus.onClicked.addListener(onMenuClicked);

        return () => {
            browser.menus.onShown.removeListener(onMenuShown);
            browser.menus.onClicked.removeListener(onMenuClicked);
        };
    });
</script>

<li
    class="receiver"
    class:receiver--result={!!result}
    bind:this={receiverElement}
    on:contextmenu={onContextMenu}
>
    <img
        class="receiver__icon"
        src="icons/{device.capabilities & ReceiverDeviceCapabilities.VIDEO_OUT
            ? 'device-video.svg'
            : 'device-audio.svg'}"
        alt=""
        height="24"
        width="24"
    />
    <div class="receiver__details">
        <div class="receiver__name">
            {#if result}
                {@html fuzzysort.highlight(result)}
            {:else}
                {device.friendlyName}
            {/if}
        </div>
        {#if application && !application.isIdleScreen}
            <div class="receiver__status">
                <span class="receiver__app-name">
                    {application.displayName}
                </span>
                {#if application.statusText !== application.displayName}
                    · {application.statusText}
                {/if}
            </div>
        {/if}
    </div>
    {#if application && !application.isIdleScreen}
        <button
            class="receiver__stop-button"
            on:click={() => dispatch("stop", { device })}
        >
            {_("popupStopButtonTitle")}
        </button>
    {:else if isAnyMediaTypeAvailable}
        <button
            class="receiver__cast-button"
            disabled={isConnecting || isAnyConnecting || !isMediaTypeAvailable}
            on:click={() => {
                isConnecting = true;
                dispatch("cast", { device });
            }}
        >
            {#if isConnecting}
                {_("popupCastingButtonTitle", "")}<LoadingIndicator />
            {:else}
                {_("popupCastButtonTitle")}
            {/if}
        </button>
    {/if}

    <button
        type="button"
        class="receiver__expand-button ghost"
        class:receiver__expand-button--expanded={isExpanded}
        title="Show Details & Volume"
        on:click={() => {
            isExpanded = !isExpanded;
            isExpandedUserModified = true;
        }}
    />

    {#if isExpanded}
        <div class="receiver__expanded">
            {#if mediaStatus}
                <ReceiverMedia
                    status={mediaStatus}
                    showImage={opts?.receiverSelectorShowMediaImages}
                    {device}
                    {textTracks}
                    on:togglePlayback={() => handleMediaPlayPause()}
                    on:previous={() => handleMediaSkipPrevious()}
                    on:next={() => handleMediaSkipNext()}
                    on:seek={ev => {
                        sendMediaMessage({
                            type: "SEEK",
                            currentTime: ev.detail.position
                        });
                    }}
                    on:trackChanged={ev =>
                        handleMediaTrackChange(ev.detail.activeTrackIds)}
                    on:volumeChanged={ev => handleVolumeChange(ev.detail)}
                />
            {:else if device.status?.volume}
                <div style="padding: 15px; display: flex; align-items: center; gap: 10px;">
                    <span style="color: #ccc; font-size: 12px; font-weight: bold;">TV Volume:</span>
                    <input
                        type="range"
                        class="slider media__volume-slider"
                        step="0.05"
                        max="1"
                        value={device.status.volume.muted ? 0 : device.status.volume.level}
                        on:change={ev => {
                            handleVolumeChange({ level: ev.currentTarget.valueAsNumber });
                        }}
                    />
                </div>
            {:else}
                <div style="padding: 10px; color: #888; font-size: 12px; text-align: center;">Device is offline</div>
            {/if}
        </div>
    {/if}
</li>
