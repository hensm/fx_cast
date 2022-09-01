"use strict";

import { v4 as uuid } from "uuid";

import logger from "../../../lib/logger";

import { Volume, Error as CastError } from "../classes";
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
import { ErrorCode } from "../enums";

import type { SenderMediaMessage } from "../types";
import { getEstimatedTime } from "../../utils";

export const NS_MEDIA = "urn:x-cast:com.google.cast.media";

type UpdateListener = (isAlive: boolean) => void;

export default class Media {
    #id = uuid();

    // Timestamp of last status update
    _lastUpdateTime = 0;
    _updateListeners = new Set<UpdateListener>();

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

    constructor(
        public sessionId: string,
        public mediaSessionId: number,
        public _sendMediaMessage: (
            message: DistributiveOmit<SenderMediaMessage, "requestId">
        ) => Promise<void>
    ) {}

    addUpdateListener(listener: UpdateListener) {
        this._updateListeners.add(listener);
    }
    removeUpdateListener(listener: UpdateListener) {
        this._updateListeners.delete(listener);
    }

    editTracksInfo(
        editTracksInfoRequest: EditTracksInfoRequest,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        this._sendMediaMessage({
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
            lastUpdateTime: this._lastUpdateTime,
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
            lastUpdateTime: this._lastUpdateTime,
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
                lastUpdateTime: this._lastUpdateTime,
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
        this._sendMediaMessage({
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
        this._sendMediaMessage({
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
        this._sendMediaMessage({
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
        this._sendMediaMessage({
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
        this._sendMediaMessage({
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

            this._sendMediaMessage({
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

            this._sendMediaMessage({
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

        this._sendMediaMessage({
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

        this._sendMediaMessage({
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
        this._sendMediaMessage({
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
        this._sendMediaMessage({
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

        this._sendMediaMessage({
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
        this._sendMediaMessage({
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
        this._sendMediaMessage({
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
        this._sendMediaMessage({
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

        this._sendMediaMessage({
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
