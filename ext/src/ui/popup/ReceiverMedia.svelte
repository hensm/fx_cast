<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";

    import { ReceiverDevice } from "../../types";
    import { MediaStatus, _MediaCommand } from "../../cast/sdk/types";
    import { Image, Volume } from "../../cast/sdk/classes";
    import {
        MetadataType,
        PlayerState,
        StreamType,
        TrackType
    } from "../../cast/sdk/media/enums";

    const _ = browser.i18n.getMessage;

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

    $: hasDuration = status.media?.duration && status.media?.duration > 0;
    $: isLive = status.supportedMediaCommands & _MediaCommand.SEEK;

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
    let currentTime = getEstimatedTime();

    deviceStore.subscribe(devices => {
        const newDevice = devices.find(newDevice => newDevice.id === device.id);
        if (newDevice?.mediaStatus?.currentTime) {
            lastUpdateTime = Date.now();
            currentTime = newDevice.mediaStatus.currentTime;
        }
    });

    // Update estimated time every second
    onMount(() => {
        const intervalId = window.setInterval(() => {
            if (currentTime !== getEstimatedTime()) {
                currentTime = getEstimatedTime();
            }
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    });

    /**
     * Estimates the current playback position based on the last status
     * update.
     */
    function getEstimatedTime() {
        if (!status.currentTime) return 0;

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
        ret += `${date.getUTCMinutes().toString().padStart(2, "0")}:`;
        ret += date.getUTCSeconds().toString().padStart(2, "0");
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
        <!-- Seek bar -->
        {#if status.media && status.media?.duration && hasDuration && isLive}
            <div class="media__seek">
                {#if status.media?.streamType === StreamType.LIVE}
                    <span class="media__live">
                        {_("popupMediaLive")}
                    </span>
                {/if}
                <span class="media__current-time">
                    {formatTime(currentTime)}
                </span>
                <input
                    type="range"
                    class="slider media__seek-bar"
                    class:slider--indeterminate={status.playerState ===
                        PlayerState.BUFFERING}
                    aria-label={_("popupMediaSeek")}
                    max={status.media.duration ?? currentTime}
                    value={currentTime}
                    on:change={ev =>
                        dispatch("seek", {
                            position: ev.currentTarget.valueAsNumber
                        })}
                />
                <span class="media__remaining-time">
                    -{formatTime(status.media?.duration - currentTime)}
                </span>
            </div>
        {/if}

        <div class="media__buttons">
            {#if status.supportedMediaCommands & _MediaCommand.QUEUE_PREV}
                <button
                    class="media__previous-button ghost"
                    title={_("popupMediaSkipPrevious")}
                    on:click={() => dispatch("previous")}
                />
            {/if}
            {#if status.supportedMediaCommands & _MediaCommand.SEEK}
                <button
                    class="media__backward-button ghost"
                    title={_("popupMediaSeekBackward")}
                    disabled={!isPlayingOrPaused}
                    on:click={() =>
                        dispatch("seek", { position: currentTime - 5 })}
                />
            {/if}

            {#if status.supportedMediaCommands & _MediaCommand.PAUSE}
                <button
                    class={`ghost ${
                        status.playerState === PlayerState.PLAYING ||
                        status.playerState === PlayerState.BUFFERING
                            ? "media__pause-button"
                            : "media__play-button"
                    }`}
                    title={isPlayingOrPaused &&
                    status.playerState === PlayerState.PLAYING
                        ? _("popupMediaPause")
                        : _("popupMediaPlay")}
                    disabled={!isPlayingOrPaused}
                    on:click={() => dispatch("togglePlayback")}
                />
            {/if}

            {#if status.supportedMediaCommands & _MediaCommand.SEEK}
                <button
                    class="media__forward-button ghost"
                    disabled={!isPlayingOrPaused}
                    title={_("popupMediaSeekForward")}
                    on:click={() =>
                        dispatch("seek", { position: currentTime + 5 })}
                />
            {/if}
            {#if status.supportedMediaCommands & _MediaCommand.QUEUE_NEXT}
                <button
                    class="media__next-button ghost"
                    title={_("popupMediaSkipNext")}
                    on:click={() => dispatch("next")}
                />
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
                    title={_("popupMediaSubtitlesClosedCaptions")}
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
                    <option value={undefined}>
                        {_("popupMediaSubtitlesClosedCaptionsOff")}
                    </option>
                    {#each textTracks as track}
                        <option value={track.trackId}>
                            {track.name ?? track.trackId}
                        </option>
                    {/each}
                </select>
            {/if}

            {#if !(status.supportedMediaCommands & _MediaCommand.SEEK) && isLive}
                <span class="media__live">
                    {_("popupMediaLive")}
                </span>
            {/if}

            {#if device.status?.volume}
                {@const volume = device.status?.volume}
                {@const isMuted = volume.muted || volume.level === 0}

                <div class="media__volume">
                    <button
                        class="media__mute-button ghost"
                        class:media__mute-button--muted={isMuted}
                        disabled={!("muted" in volume)}
                        title={isMuted
                            ? _("popupMediaUnmute")
                            : _("popupMediaMute")}
                        on:click={() => {
                            /**
                             * If not muted and volume is at 0, max out
                             * volume instead of flipping mute value.
                             */
                            if (!volume.muted && volume.level === 0) {
                                dispatch("volumeChanged", {
                                    level: 1
                                });
                            } else {
                                dispatch("volumeChanged", {
                                    muted: !volume.muted
                                });
                            }
                        }}
                    />
                    <input
                        type="range"
                        class="slider media__volume-slider"
                        aria-label={_("popupMediaVolume")}
                        disabled={!("level" in volume)}
                        step="0.05"
                        max={1}
                        value={volume.muted ? 0 : volume.level}
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
