<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";

    import { PlayerState } from "../../cast/sdk/media/enums";
    import { SenderMediaMessage, SenderMessage } from "../../cast/sdk/types";
    import { ReceiverDevice } from "../../types";

    import { Port } from "../../messaging";

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

    /** Receiver device to display. */
    export let device: ReceiverDevice;

    /** Current receiver application (if available) */
    $: application = device.status?.applications?.[0];
    /** Current media status (if available) */
    $: mediaStatus = device.mediaStatus;

    let isExpanded = false;
    let isConnecting = false;

    function sendReceiverMessage(
        partialMessage: DistributiveOmit<SenderMessage, "requestId">
    ) {
        const message: SenderMessage = {
            ...partialMessage,
            requestId: 0
        };

        port?.postMessage({
            subject: "receiverSelector:receiverMessage",
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
            subject: "receiverSelector:mediaMessage",
            data: { deviceId: device.id, message }
        });
    }

    onMount(() => {
        sendMediaMessage({
            type: "GET_STATUS"
        });
    });
</script>

<li class="receiver">
    <div class="receiver__details">
        <div class="receiver__name">
            {device.friendlyName}
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
    {:else}
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
        title={_("popupShowDetailsTitle")}
        disabled={!mediaStatus}
        on:click={() => {
            isExpanded = !isExpanded;
        }}
    />

    {#if isExpanded && mediaStatus}
        <div class="receiver__expanded">
            <ReceiverMedia
                status={mediaStatus}
                {device}
                on:togglePlayback={() => {
                    switch (mediaStatus?.playerState) {
                        case PlayerState.PLAYING:
                            sendMediaMessage({ type: "PAUSE" });
                            break;
                        case PlayerState.PAUSED:
                            sendMediaMessage({ type: "PLAY" });
                            break;
                    }
                }}
                on:previous={() => {
                    sendMediaMessage({
                        type: "QUEUE_UPDATE",
                        jump: -1
                    });
                }}
                on:next={() => {
                    sendMediaMessage({
                        type: "QUEUE_UPDATE",
                        jump: 1
                    });
                }}
                on:seek={ev => {
                    sendMediaMessage({
                        type: "SEEK",
                        currentTime: ev.detail.position
                    });
                }}
                on:trackChanged={ev => {
                    sendMediaMessage({
                        type: "EDIT_TRACKS_INFO",
                        activeTrackIds: ev.detail.activeTrackIds
                    });
                }}
                on:volumeChanged={ev => {
                    sendReceiverMessage({
                        type: "SET_VOLUME",
                        volume: ev.detail
                    });
                }}
            />
        </div>
    {/if}
</li>
