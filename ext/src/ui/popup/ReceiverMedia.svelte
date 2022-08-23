<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";

    import { ReceiverDevice } from "../../types";
    import { MediaStatus, _MediaCommand } from "../../cast/sdk/types";
    import { Image, Volume } from "../../cast/sdk/classes";
    import {
        MetadataType,
        PlayerState,
        TrackType
    } from "../../cast/sdk/media/enums";

    import deviceStore from "./deviceStore";

    const dispatch = createEventDispatcher<{
        togglePlayback: void;
        seek: { position: number };
        previous: void;
        next: void;
        trackChanged: { activeTrackIds: number[] };
        volumeChanged: Partial<Volume>;
    }>();

    export let status: MediaStatus;
    export let device: ReceiverDevice;

    $: isPlayingOrPaused =
        status.playerState === PlayerState.PLAYING ||
        status.playerState === PlayerState.PAUSED;

    let mediaTitle: Optional<string>;
    let mediaSubtitle: Optional<string>;
    let mediaImage: Optional<Image>;

    // Choose subset of metadata depending on metadata type
    $: {
        const metadata = status?.media?.metadata;

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
    $: textTracks = status?.media?.tracks
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

    // Keep track of update times for currentTime estimations
    let lastUpdateTime = 0;
    deviceStore.subscribe(devices => {
        const newDevice = devices.find(newDevice => newDevice.id === device.id);
        if (newDevice?.mediaStatus?.currentTime) {
            lastUpdateTime = Date.now();
        }
    });

    // Update estimated time every second
    let currentTime = status.currentTime;
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
        if (!status) return 0;
        if (status.playerState === PlayerState.PLAYING && lastUpdateTime) {
            let estimatedTime =
                status.currentTime + (Date.now() - lastUpdateTime) / 1000;

            if (estimatedTime < 0) {
                estimatedTime = 0;
            } else if (
                status.media?.duration &&
                estimatedTime > status.media.duration
            ) {
                estimatedTime = status.media.duration;
            }

            return estimatedTime;
        }

        return status.currentTime;
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
            {#if status.media}
                <span class="media__current-time">
                    {formatTime(currentTime)}
                </span>
                <input
                    type="range"
                    class="slider media__progress-bar"
                    class:slider--indeterminate={status.playerState ===
                        PlayerState.BUFFERING}
                    max={status.media.duration ?? currentTime}
                    value={currentTime}
                    on:change={ev =>
                        dispatch("seek", {
                            position: ev.currentTarget.valueAsNumber
                        })}
                />
                <span class="media__remaining-time">
                    {#if status.media.duration}
                        -{formatTime(status.media?.duration - currentTime)}
                    {:else}
                        -{formatTime(currentTime)}
                    {/if}
                </span>
            {:else}
                <progress class="slider media__progress-bar" />
            {/if}
        </div>

        <div class="media__buttons">
            {#if status.supportedMediaCommands & _MediaCommand.QUEUE_PREV}
                <button
                    class="media__previous-button ghost"
                    on:click={() => dispatch("previous")}
                >
                    <img src="icons/previous.svg" alt="icon, previous" />
                </button>
            {/if}
            {#if status.supportedMediaCommands & _MediaCommand.SEEK}
                <button
                    class="media__backward-button ghost"
                    disabled={!isPlayingOrPaused}
                    on:click={() =>
                        dispatch("seek", { position: currentTime - 5 })}
                >
                    <img src="icons/backward.svg" alt="icon, backward" />
                </button>
            {/if}

            <button
                class="media__play-button ghost"
                disabled={!isPlayingOrPaused}
                on:click={() => dispatch("togglePlayback")}
            >
                <img
                    src={`icons/${
                        status.playerState === PlayerState.PLAYING ||
                        status.playerState === PlayerState.BUFFERING
                            ? "pause.svg"
                            : "play.svg"
                    }`}
                    alt="icon, play"
                />
            </button>

            {#if status.supportedMediaCommands & _MediaCommand.SEEK}
                <button
                    class="media__forward-button ghost"
                    disabled={!isPlayingOrPaused}
                    on:click={() =>
                        dispatch("seek", { position: currentTime + 5 })}
                >
                    <img src="icons/forward.svg" alt="icon, forward" />
                </button>
            {/if}
            {#if status.supportedMediaCommands & _MediaCommand.QUEUE_NEXT}
                <button
                    class="media__next-button ghost"
                    on:click={() => dispatch("next")}
                >
                    <img src="icons/next.svg" alt="icon, next" />
                </button>
            {/if}

            {#if textTracks?.length && status.supportedMediaCommands & _MediaCommand.EDIT_TRACKS}
                {@const activeTextTrackId = status.activeTrackIds?.find(
                    trackId =>
                        textTracks?.find(track => track.trackId === trackId)
                )}

                <select
                    class="media__cc-button ghost"
                    class:media__cc-button--off={activeTextTrackId ===
                        undefined}
                    value={activeTextTrackId}
                    on:change={ev => {
                        if (!status.activeTrackIds) return;

                        let activeTrackIds = status.activeTrackIds.filter(
                            trackId => trackId !== activeTextTrackId
                        );

                        const trackId = parseInt(ev.currentTarget.value);
                        if (!Number.isNaN(trackId)) {
                            activeTrackIds.push(trackId);
                        }

                        dispatch("trackChanged", { activeTrackIds });
                    }}
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
                    <button
                        class="media__mute-button ghost"
                        on:click={() => {
                            if (!device.status?.volume) return;
                            dispatch("volumeChanged", {
                                muted: !device.status.volume.muted
                            });
                        }}
                    >
                        <img
                            src="icons/{device.status?.volume.muted
                                ? 'audio-muted.svg'
                                : 'audio.svg'}"
                            alt="icon, audio"
                        />
                    </button>
                    <input
                        type="range"
                        class="slider media__volume-slider"
                        step="0.05"
                        max={1}
                        value={device.status.volume.muted
                            ? 0
                            : device.status.volume.level}
                        on:change={ev => {
                            dispatch("volumeChanged", {
                                level: ev.currentTarget.valueAsNumber
                            });
                        }}
                    />
                </div>
            {/if}
        </div>
    </div>
</div>
