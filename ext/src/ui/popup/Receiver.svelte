<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";

    import { Image } from "../../cast/sdk/classes";
    import {
        MetadataType,
        PlayerState,
        TrackType
    } from "../../cast/sdk/media/enums";
    import { _MediaCommand } from "../../cast/sdk/types";
    import { ReceiverDevice } from "../../types";

    import LoadingIndicator from "../LoadingIndicator.svelte";
    import deviceStore from "./deviceStore";

    const _ = browser.i18n.getMessage;

    const dispatch = createEventDispatcher<{
        cast: { device: ReceiverDevice };
        stop: { device: ReceiverDevice };
    }>();

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

    // Keep track of update times for currentTime estimations
    let lastUpdateTime = 0;
    deviceStore.subscribe(devices => {
        const newDevice = devices.find(newDevice => newDevice.id === device.id);
        if (newDevice?.mediaStatus?.currentTime) {
            lastUpdateTime = Date.now();
        }
    });

    let mediaTitle: Optional<string>;
    let mediaSubtitle: Optional<string>;
    let mediaImage: Optional<Image>;

    // Choose subset of metadata depending on metadata type
    $: {
        const metadata = mediaStatus?.media?.metadata;

        mediaTitle = metadata?.title;
        mediaImage = metadata?.images?.[0];
        mediaSubtitle = undefined;

        if (metadata) {
            switch (metadata.metadataType) {
                case MetadataType.AUDIOBOOK_CHAPTER:
                    if (metadata.bookTitle) {
                        metadata.title = metadata.bookTitle;
                    }
                    metadata.subtitle = metadata.chapterTitle;
                    break;
                case MetadataType.MUSIC_TRACK:
                    mediaSubtitle = metadata.artist;
                    break;
                case MetadataType.TV_SHOW:
                    if (metadata.seriesTitle) {
                        mediaTitle = metadata.seriesTitle;
                        mediaSubtitle = metadata.title;
                    }
                    break;

                case MetadataType.MOVIE:
                case MetadataType.GENERIC:
                    mediaSubtitle = metadata.subtitle;
            }
        }
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
                mediaStatus && isExpanded
                    ? "photon_arrowhead_up.svg"
                    : "photon_arrowhead_down.svg"
            }`}
            alt="icon, arrow down"
        />
    </button>

    {#if isExpanded}
        <div class="receiver__expanded">
            {#if mediaStatus}
                <div class="media" style:--media-image="url({mediaImage?.url})">
                    {#if mediaTitle}
                        <div class="media__metadata">
                            <div class="media__title" title={mediaTitle}>
                                {mediaTitle}
                            </div>
                            {#if mediaSubtitle}
                                <div class="media__subtitle">
                                    {mediaSubtitle}
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <div class="media__controls">
                        <div class="media__progress">
                            {#if mediaStatus.media}
                                <span class="media__start"
                                    >{formatTime(currentTime)}</span
                                >
                                <input
                                    type="range"
                                    class="media__progress-bar"
                                    max={mediaStatus.media.duration ??
                                        currentTime}
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

                        {#if mediaStatus.supportedMediaCommands & _MediaCommand.QUEUE_PREV}
                            <button class="media__previous-button ghost">
                                <img
                                    src="icons/previous.svg"
                                    alt="icon, previous"
                                />
                            </button>
                        {/if}
                        {#if mediaStatus.supportedMediaCommands & _MediaCommand.SEEK}
                            <button class="media__backward-button ghost">
                                <img
                                    src="icons/backward.svg"
                                    alt="icon, backward"
                                />
                            </button>
                        {/if}

                        <button class="media__play-button ghost">
                            <img
                                src={`icons/${
                                    mediaStatus.playerState ===
                                    PlayerState.PAUSED
                                        ? "play.svg"
                                        : "pause.svg"
                                }`}
                                alt="icon, play"
                            />
                        </button>

                        {#if mediaStatus.supportedMediaCommands & _MediaCommand.SEEK}
                            <button class="media__forward-button ghost">
                                <img
                                    src="icons/forward.svg"
                                    alt="icon, forward"
                                />
                            </button>
                        {/if}
                        {#if mediaStatus.supportedMediaCommands & _MediaCommand.QUEUE_NEXT}
                            <button class="media__next-button ghost">
                                <img src="icons/next.svg" alt="icon, next" />
                            </button>
                        {/if}

                        {#if textTracks?.length && mediaStatus.supportedMediaCommands & _MediaCommand.EDIT_TRACKS}
                            {@const activeTextTrack =
                                mediaStatus.activeTrackIds?.find(trackId =>
                                    textTracks?.find(
                                        track => track.trackId === trackId
                                    )
                                )}

                            <select
                                class="media__cc-button ghost"
                                class:media__cc-button--off={activeTextTrack ===
                                    undefined}
                                value={activeTextTrack}
                            >
                                <option value={undefined}>Off</option>
                                {#each textTracks as track}
                                    <option value={track.trackId}>
                                        {track.name ?? track.trackId}
                                    </option>
                                {/each}
                            </select>
                        {/if}

                        {#if device.status?.volume}
                            <div class="media__volume">
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
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</li>
