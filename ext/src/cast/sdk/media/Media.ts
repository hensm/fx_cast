"use strict";

import { v4 as uuid } from "uuid";

import { Logger } from "../../../lib/logger";
import { getEstimatedTime } from "../../utils";
import type { SenderMediaMessage } from "../types";

import { Volume, Error as CastError } from "../classes";
import { ErrorCode } from "../enums";

import {
    BreakStatus,
    EditTracksInfoRequest,
    GetStatusRequest,
    LiveSeekableRange,
    MediaInfo,
    PauseRequest,
    PlayRequest,
    QueueData,
    QueueJumpRequest,
    QueueInsertItemsRequest,
    QueueItem,
    QueueSetPropertiesRequest,
    QueueRemoveItemsRequest,
    QueueReorderItemsRequest,
    QueueUpdateItemsRequest,
    SeekRequest,
    StopRequest,
    VideoInformation,
    VolumeRequest
} from "./classes";
import { PlayerState, RepeatMode } from "./enums";

const logger = new Logger("fx_cast [sdk :: cast.Media]");

export const NS_MEDIA = "urn:x-cast:com.google.cast.media";

type MediaMessageCallback = (
    message: DistributiveOmit<SenderMediaMessage, "requestId">
) => Promise<void>;

const MediaMessageCallbacks = new WeakMap<Media, MediaMessageCallback>();
export const MediaUpdateListeners = new WeakMap<Media, Set<UpdateListener>>();
export const MediaLastUpdateTimes = new WeakMap<Media, number>();

/** Creates a Media object and initializes private data. */
export function createMedia(
    mediaArgs: ConstructorParameters<typeof Media>,
    mediaMessageCallback: MediaMessageCallback
) {
    const media = new Media(...mediaArgs);
    MediaMessageCallbacks.set(media, mediaMessageCallback);
    MediaUpdateListeners.set(media, new Set());
    MediaLastUpdateTimes.set(media, 0);

    return media;
}

type UpdateListener = (isAlive: boolean) => void;

export default class Media {
    #id = uuid();

    get #updateListeners() {
        const updateListeners = MediaUpdateListeners.get(this);
        if (!updateListeners)
            throw logger.error("Missing media update listeners!");
        return updateListeners;
    }
    get #mediaMessageCallback() {
        const callback = MediaMessageCallbacks.get(this);
        if (!callback) throw logger.error("Missing media message callback!");
        return callback;
    }
    get #lastUpdateTime() {
        const lastUpdateTime = MediaLastUpdateTimes.get(this);
        if (lastUpdateTime === undefined)
            throw logger.error("Missing last update time!");
        return lastUpdateTime;
    }

    activeTrackIds: Nullable<number[]> = null;
    breakStatus?: BreakStatus;
    currentTime = 0;
    customData: unknown = null;
    idleReason: Nullable<string> = null;
    liveSeekableRange?: LiveSeekableRange;
    media: Nullable<MediaInfo> = null;
    playbackRate = 1;
    playerState = PlayerState.IDLE;
    repeatMode = RepeatMode.OFF;
    supportedMediaCommands: string[] = [];
    videoInfo?: VideoInformation;
    volume: Volume = new Volume();

    // Queues
    items: Nullable<QueueItem[]> = null;
    currentItemId: Nullable<number> = null;
    loadingItemId: Nullable<number> = null;
    preloadedItemId: Nullable<number> = null;
    queueData?: QueueData;

    constructor(public sessionId: string, public mediaSessionId: number) {}

    addUpdateListener(listener: UpdateListener) {
        this.#updateListeners?.add(listener);
    }
    removeUpdateListener(listener: UpdateListener) {
        this.#updateListeners?.delete(listener);
    }

    editTracksInfo(
        editTracksInfoRequest: EditTracksInfoRequest,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...editTracksInfoRequest,
            type: "EDIT_TRACKS_INFO",
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    /**
     * Estimates the current break clip position based on the last
     * information reported by the receiver.
     */
    getEstimatedBreakClipTime() {
        if (!this.breakStatus?.currentBreakClipTime) return;

        const currentBreakClip = this.media?.breakClips?.find(
            breakClip => breakClip.id === this.breakStatus?.breakClipId
        );
        if (!currentBreakClip) return;

        return getEstimatedTime({
            currentTime: this.breakStatus.currentBreakClipTime,
            lastUpdateTime: this.#lastUpdateTime,
            duration: currentBreakClip.duration
        });
    }

    /**
     * Estimates the current break position based on the last
     * information reported by the receiver.
     */
    getEstimatedBreakTime() {
        if (!this.breakStatus?.currentBreakTime) return;

        const currentBreak = this.media?.breaks?.find(
            break_ => break_.id === this.breakStatus?.breakId
        );
        if (!currentBreak) return;

        return getEstimatedTime({
            currentTime: this.breakStatus.currentBreakTime,
            lastUpdateTime: this.#lastUpdateTime,
            duration: currentBreak.duration
        });
    }

    getEstimatedLiveSeekableRange() {
        logger.info("STUB :: Media#getEstimatedLiveSeekableRange");
    }

    /**
     * Estimates the current playback position based on the last
     * information reported by the receiver.
     */
    getEstimatedTime(): number {
        if (this.playerState === PlayerState.PLAYING) {
            return getEstimatedTime({
                currentTime: this.currentTime,
                lastUpdateTime: this.#lastUpdateTime,
                duration: this.media?.duration
            });
        }

        return this.currentTime;
    }

    /**
     * Request media status from the receiver application. This will
     * also trigger any added media update listeners.
     */
    getStatus(
        getStatusRequest = new GetStatusRequest(),
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...getStatusRequest,
            type: "MEDIA_GET_STATUS",
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    pause(
        pauseRequest = new PauseRequest(),
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...pauseRequest,
            type: "PAUSE",
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    play(
        playRequest = new PlayRequest(),
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...playRequest,
            type: "PLAY",
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueAppendItem(
        item: QueueItem,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...new QueueInsertItemsRequest([item]),
            type: "QUEUE_INSERT",
            sessionId: this.sessionId,
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueInsertItems(
        queueInsertItemsRequest: QueueInsertItemsRequest,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...queueInsertItemsRequest,
            type: "QUEUE_INSERT",
            sessionId: this.sessionId,
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueJumpToItem(
        itemId: number,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        if (this.items?.find(item => item.itemId === itemId)) {
            const jumpRequest = new QueueJumpRequest();
            jumpRequest.currentItemId = itemId;

            this.#mediaMessageCallback?.({
                ...jumpRequest,
                type: "QUEUE_UPDATE",
                sessionId: this.sessionId,
                mediaSessionId: this.mediaSessionId
            })
                .then(successCallback)
                .catch(errorCallback);
        }
    }

    queueMoveItemToNewIndex(
        itemId: number,
        newIndex: number,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        // Return early if not in queue
        if (!this.items) {
            return;
        }

        const itemIndex = this.items.findIndex(item => item.itemId === itemId);

        if (itemIndex !== -1) {
            // New index must not be negative
            if (newIndex < 0) {
                if (errorCallback) {
                    errorCallback(new CastError(ErrorCode.INVALID_PARAMETER));
                }
            } else if (newIndex == itemIndex) {
                if (successCallback) {
                    successCallback();
                }
            }
        } else {
            if (newIndex > itemIndex) {
                newIndex++;
            }

            const reorderItemsRequest = new QueueReorderItemsRequest([itemId]);
            if (newIndex < this.items.length) {
                const existingItem = this.items[newIndex];
                reorderItemsRequest.insertBefore = existingItem.itemId;
            }

            this.#mediaMessageCallback?.({
                ...reorderItemsRequest,
                type: "QUEUE_REORDER",
                sessionId: this.sessionId,
                mediaSessionId: this.mediaSessionId
            })
                .then(successCallback)
                .catch(errorCallback);
        }
    }

    queueNext(
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        const jumpRequest = new QueueJumpRequest();
        jumpRequest.jump = 1;

        this.#mediaMessageCallback?.({
            ...jumpRequest,
            type: "QUEUE_UPDATE",
            sessionId: this.sessionId,
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    queuePrev(
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        const jumpRequest = new QueueJumpRequest();
        jumpRequest.jump = -1;

        this.#mediaMessageCallback?.({
            ...jumpRequest,
            type: "QUEUE_UPDATE",
            sessionId: this.sessionId,
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueRemoveItem(
        itemId: number,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        const item = this.items?.find(item => item.itemId === itemId);
        if (item) {
            this.queueRemoveItems(
                new QueueRemoveItemsRequest([itemId]),
                successCallback,
                errorCallback
            );
        }
    }

    queueRemoveItems(
        queueRemoveItemsRequest: QueueRemoveItemsRequest,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...queueRemoveItemsRequest,

            mediaSessionId: this.mediaSessionId,
            type: "QUEUE_REMOVE",
            sessionId: this.sessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueReorderItems(
        queueReorderItemsRequest: QueueReorderItemsRequest,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...queueReorderItemsRequest,

            mediaSessionId: this.mediaSessionId,
            type: "QUEUE_REORDER",
            sessionId: this.sessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueSetRepeatMode(
        repeatMode: string,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        const setPropertiesRequest = new QueueSetPropertiesRequest();
        setPropertiesRequest.repeatMode = repeatMode;

        this.#mediaMessageCallback?.({
            ...setPropertiesRequest,
            type: "QUEUE_UPDATE",
            sessionId: this.sessionId,
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueUpdateItems(
        queueUpdateItemsRequest: QueueUpdateItemsRequest,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...queueUpdateItemsRequest,
            type: "QUEUE_UPDATE",
            sessionId: this.sessionId,
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    seek(
        seekRequest: SeekRequest,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...seekRequest,
            type: "SEEK",
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    setVolume(
        volumeRequest: VolumeRequest,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this.#mediaMessageCallback?.({
            ...volumeRequest,
            type: "MEDIA_SET_VOLUME",
            mediaSessionId: this.mediaSessionId
        })
            .then(successCallback)
            .catch(errorCallback);
    }

    stop(
        stopRequest?: StopRequest,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        if (!stopRequest) {
            stopRequest = new StopRequest();
        }

        this.#mediaMessageCallback?.({
            ...stopRequest,
            type: "STOP",
            mediaSessionId: this.mediaSessionId
        })
            .then(() => {
                if (successCallback) {
                    successCallback();
                }
            })
            .catch(errorCallback);
    }

    supportsCommand(command: string): boolean {
        return this.supportedMediaCommands.includes(command);
    }
}
