<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";

    import { PlayerState } from "../../cast/sdk/media/enums";
    import { ReceiverDevice } from "../../types";

    import LoadingIndicator from "../LoadingIndicator.svelte";
    import deviceStore from "./deviceStore";

    const _ = browser.i18n.getMessage;

    const dispatch = createEventDispatcher<{
        cast: { device: ReceiverDevice };
        stop: { device: ReceiverDevice };
    }>();

    /**
     * Whether there are sessions being established for any receiver. */
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

    // Keep track of update times for currentTime estimations
    let lastUpdateTime = 0;
    deviceStore.subscribe(devices => {
        const newDevice = devices.find(newDevice => newDevice.id === device.id);
        if (newDevice?.mediaStatus?.currentTime) {
            lastUpdateTime = Date.now();
        }
    });

    // Update estimated time every second
    let currentTime = 0;
    onMount(() => {
        window.setInterval(() => {
            if (currentTime !== getEstimatedTime()) {
                currentTime = getEstimatedTime();
            }
        }, 1000);
    });

    /**
     * Estimates the current playback position based on the last status
     * update.
     */
    function getEstimatedTime() {
        if (!mediaStatus) return 0;
        if (mediaStatus.playerState === PlayerState.PLAYING && lastUpdateTime) {
            let estimatedTime =
                mediaStatus.currentTime + (Date.now() - lastUpdateTime) / 1000;

            if (estimatedTime < 0) {
                estimatedTime = 0;
            } else if (
                mediaStatus.media?.duration &&
                estimatedTime > mediaStatus.media.duration
            ) {
                estimatedTime = mediaStatus.media.duration;
            }

            return estimatedTime;
        }

        return mediaStatus.currentTime;
    }

    /** Formats seconds into HH:MM:SS */
    function formatTime(seconds: number) {
        const date = new Date(seconds * 1000);
        const hours = date.getUTCHours();

        let ret = "";
        if (hours) ret += `${hours}:`;
        ret += `${date.getUTCMinutes()}:`;
        ret += `${date.getUTCSeconds()}`.padStart(2, "0");
        return ret;
    }
</script>

<li class="receiver">
    <div class="receiver__details">
        <div class="receiver__name">
            {device.friendlyName}
        </div>
        {#if application && !application.isIdleScreen}
            <div class="receiver__status">{application.statusText}</div>
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
        class="ghost"
        disabled={!mediaStatus}
        on:click={() => {
            isExpanded = !isExpanded;
        }}
    >
        <img
            src={`../assets/${
                isExpanded
                    ? "photon_arrowhead_up.svg"
                    : "photon_arrowhead_down.svg"
            }`}
            alt="icon, arrow down"
        />
    </button>

    {#if isExpanded}
        <div class="receiver__expanded">
            {#if mediaStatus}
                <div class="media">
                    {#if mediaStatus.media?.metadata?.title}
                        {@const metadata = mediaStatus.media.metadata}

                        <div class="media__metadata">
                            <div class="media__title">
                                {metadata.title}
                            </div>
                            {#if "subtitle" in metadata}
                                <div class="media__subtitle">
                                    {metadata.subtitle}
                                </div>
                            {/if}
                        </div>
                    {/if}
                    <div class="media__progress">
                        {#if mediaStatus.media}
                            <span class="media__start"
                                >{formatTime(currentTime)}</span
                            >
                            <input
                                type="range"
                                class="media__progress-bar"
                                max={mediaStatus.media.duration ?? currentTime}
                                value={currentTime}
                            />
                            <span class="media__end">
                                {#if mediaStatus.media.duration}
                                    -{formatTime(
                                        mediaStatus.media?.duration -
                                            currentTime
                                    )}
                                {:else}
                                    -{formatTime(currentTime)}
                                {/if}
                            </span>
                        {:else}
                            <progress />
                        {/if}
                    </div>

                    <button class="media__play-button ghost">
                        <img
                            src={`icons/${
                                mediaStatus.playerState === PlayerState.PAUSED
                                    ? "play.svg"
                                    : "pause.svg"
                            }`}
                            alt="icon, play"
                        />
                    </button>

                    {#if device.status?.volume}
                        <button class="media__mute-button ghost">
                            <img
                                src="icons/{device.status?.volume.muted
                                    ? 'audio-muted.svg'
                                    : 'audio.svg'}"
                                alt="icon, audio"
                            />
                        </button>
                        <input
                            type="range"
                            class="media__volume-slider"
                            step="any"
                            max={1}
                            value={device.status.volume.muted
                                ? 0
                                : device.status.volume.level}
                        />
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</li>
