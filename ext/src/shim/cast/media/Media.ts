"use strict";

import { v1 as uuid } from "uuid";

import logger from "../../../lib/logger";

import { Volume, Error as _Error } from "../dataClasses";
import { BreakStatus, EditTracksInfoRequest, GetStatusRequest, LiveSeekableRange
       , MediaInfo, PauseRequest, PlayRequest, QueueData, QueueJumpRequest
       , QueueInsertItemsRequest, QueueItem, QueueSetPropertiesRequest
       , QueueRemoveItemsRequest, QueueReorderItemsRequest
       , QueueUpdateItemsRequest, SeekRequest, StopRequest, VideoInformation
       , VolumeRequest } from "./dataClasses";

import { PlayerState, RepeatMode } from "./enums";
import { ErrorCode } from "../enums";

import { onMessage, sendMessageResponse } from "../../eventMessageChannel";

import { ErrorCallback
       , SuccessCallback
       , UpdateListener } from "../../types";
import { SenderMediaMessage } from "../types";


export default class Media {
    #id = uuid();
    #isActive = true;

    /**
     * Timestamp of last status update
     */
    #lastUpdateTime = 0;

    #updateListeners = new Set<UpdateListener>();
    #sendMediaMessageCallbacks =
            new Map<string, [ SuccessCallback?, ErrorCallback? ]>();

    #listener = onMessage(message => {
        if ((message as any).data._id !== this.#id) {
            return;
        }

        switch (message.subject) {
            case "shim:media/updateStatus": {
                const { status } = message.data;

                // Store current update time
                this.#lastUpdateTime = Date.now();

                this.currentTime = status.currentTime;
                this.mediaSessionId = status.mediaSessionId;
                this.playbackRate = status.playbackRate;
                this.playerState = status.playerState;
                this.repeatMode = status.repeatMode;
                this.volume = status.volume;

                if (status.customData) {
                    this.customData = status.customData;
                }
                if (status.media) {
                    this.media = status.media as MediaInfo;
                }

                // Call update listeners
                for (const listener of this.#updateListeners) {
                    listener(this.#isActive);
                }

                break;
            }

            case "shim:media/sendMediaMessageResponse": {
                const { messageId, error } = message.data;
                const [ successCallback, errorCallback ] =
                        this.#sendMediaMessageCallbacks
                              .get(messageId) ?? [];

                if (error && errorCallback) {
                    errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                } else if (successCallback) {
                    successCallback();
                }

                break;
            }

        }
    });

    activeTrackIds: Nullable<number[]> = null;
    breakStatus?: BreakStatus;
    currentItemId: Nullable<number> = null;
    currentTime = 0;
    customData: any = null;
    idleReason: Nullable<string> = null;
    items: Nullable<QueueItem[]> = null;
    liveSeekableRange?: LiveSeekableRange;
    loadingItemId: Nullable<number> = null;
    media: Nullable<MediaInfo> = null;
    playbackRate = 1;
    playerState: string = PlayerState.IDLE;
    preloadedItemId: Nullable<number> = null;
    queueData?: QueueData;
    repeatMode: string = RepeatMode.OFF;
    supportedMediaCommands: string[] = [];
    videoInfo?: VideoInformation;
    volume: Volume = new Volume();


    constructor(public sessionId: string
              , public mediaSessionId: number
              , _internalSessionId: string) {

        sendMessageResponse({
            subject: "bridge:media/initialize"
          , data: {
                sessionId
              , mediaSessionId
              , _internalSessionId
              , _id: this.#id
            }
        });
    }

    addUpdateListener(listener: UpdateListener) {
        this.#updateListeners.add(listener);
    }

    editTracksInfo(editTracksInfoRequest: EditTracksInfoRequest
                 , successCallback?: SuccessCallback
                 , errorCallback?: ErrorCallback) {

        this.#sendMediaMessage(
                { type: "EDIT_TRACKS_INFO", ...editTracksInfoRequest })
            .then(successCallback)
            .catch(errorCallback);
    }

    getEstimatedBreakClipTime() {
        logger.info("STUB :: Media#getEstimatedBreakClipTime");
    }
    getEstimatedBreakTime() {
        logger.info("STUB :: Media#getEstimatedBreakTime");
    }
    getEstimatedLiveSeekableRange() {
        logger.info("STUB :: Media#getEstimatedLiveSeekableRange");
    }

    /**
     * Estimate the current playback position based on the last
     * time reported by the receiver and the current playback
     * rate.
     */
    getEstimatedTime(): number {
        if (this.playerState === PlayerState.PLAYING) {
            let estimatedTime = this.currentTime +
                    ((Date.now() - this.#lastUpdateTime) / 1000);

            // Enforce valid range
            if (estimatedTime < 0) {
                estimatedTime = 0;
            } else if (this.media?.duration &&
                    estimatedTime > this.media.duration) {
                estimatedTime = this.media.duration;
            }

            return estimatedTime;
        }

        return this.currentTime;
    }

    /**
     * Request media status from the receiver application. This
     * will also trigger any added media update listeners.
     */
    getStatus(getStatusRequest = new GetStatusRequest()
            , successCallback?: SuccessCallback
            , errorCallback?: ErrorCallback) {
        
        this.#sendMediaMessage(
                { type: "MEDIA_GET_STATUS", ...getStatusRequest })
            .then(successCallback)
            .catch(errorCallback);
    }

    pause(pauseRequest = new PauseRequest()
        , successCallback?: SuccessCallback
        , errorCallback?: ErrorCallback) {

        this.#sendMediaMessage(
                { type: "PAUSE", ...pauseRequest })
            .then(successCallback)
            .catch(errorCallback);
    }

    play(playRequest = new PlayRequest()
       , successCallback?: SuccessCallback
       , errorCallback?: ErrorCallback) {

        this.#sendMediaMessage(
                { type: "PLAY", ...playRequest })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueAppendItem(item: QueueItem
                  , successCallback?: SuccessCallback
                  , errorCallback?: ErrorCallback) {
        
        this.#sendMediaMessage(
                {
                    ...new QueueInsertItemsRequest([ item ])
                  , type: "QUEUE_INSERT"
                })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueInsertItems(queueInsertItemsRequest: QueueInsertItemsRequest
                   , successCallback?: SuccessCallback
                   , errorCallback?: ErrorCallback) {

            this.#sendMediaMessage(
                { ...queueInsertItemsRequest, type: "QUEUE_INSERT" })
            .then(successCallback)
            .catch(errorCallback);
        
    }

    queueJumpToItem(itemId: number
                  , successCallback?: SuccessCallback
                  , errorCallback?: ErrorCallback) {

        if (this.items?.find(item => item.itemId === itemId)) {
            const jumpRequest = new QueueJumpRequest();
            jumpRequest.currentItemId = itemId;

            this.#sendMediaMessage(
                    { ...jumpRequest, type: "QUEUE_UPDATE" })
                .then(successCallback)
                .catch(errorCallback);
        }
    }

    queueMoveItemToNewIndex(itemId: number
                          , newIndex: number
                          , successCallback?: SuccessCallback
                          , errorCallback?: ErrorCallback) {

        // Return early if not in queue
        if (!this.items) {
            return;
        }

        const itemIndex = this.items.findIndex(item => item.itemId === itemId);

        if (itemIndex !== -1) {
            // New index must not be negative
            if (newIndex < 0) {
                if (errorCallback) {
                    errorCallback(new _Error(ErrorCode.INVALID_PARAMETER));
                }
            } else if (newIndex == itemIndex) {
                if (successCallback) { successCallback(); }
            }
        } else {
            if (newIndex > itemIndex) {
                newIndex++;
            }

            const reorderItemsRequest =
                    new QueueReorderItemsRequest([ itemId ]);
            if (newIndex < this.items.length) {
                const existingItem = this.items[newIndex];
                reorderItemsRequest.insertBefore = existingItem.itemId;
            }

            this.#sendMediaMessage(
                    { ...reorderItemsRequest, type: "QUEUE_REORDER" })
                .then(successCallback)
                .catch(errorCallback);
        }
    }

    queueNext(successCallback?: SuccessCallback
            , errorCallback?: ErrorCallback) {

        const jumpRequest = new QueueJumpRequest();
        jumpRequest.jump = 1;

        this.#sendMediaMessage(
                { ...jumpRequest, type: "QUEUE_UPDATE" })
            .then(successCallback)
            .catch(errorCallback);
    }

    queuePrev(successCallback?: SuccessCallback
            , errorCallback?: ErrorCallback) {

        const jumpRequest = new QueueJumpRequest();
        jumpRequest.jump = -1;

        this.#sendMediaMessage(
                { ...jumpRequest, type: "QUEUE_UPDATE" })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueRemoveItem(itemId: number
                  , successCallback?: SuccessCallback
                  , errorCallback?: ErrorCallback) {

        const item = this.items?.find(item => item.itemId === itemId);
        if (item) {
            this.queueRemoveItems(
                    new QueueRemoveItemsRequest([ itemId ])
                  , successCallback, errorCallback);
        }
    }

    queueRemoveItems(queueRemoveItemsRequest: QueueRemoveItemsRequest
                   , successCallback?: SuccessCallback
                   , errorCallback?: ErrorCallback) {
        
        this.#sendMediaMessage(
                { ...queueRemoveItemsRequest, type: "QUEUE_REMOVE" })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueReorderItems(queueReorderItemsRequest: QueueReorderItemsRequest
                    , successCallback?: SuccessCallback
                    , errorCallback?: ErrorCallback) {

        this.#sendMediaMessage(
                { ...queueReorderItemsRequest, type: "QUEUE_REORDER" })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueSetRepeatMode(repeatMode: string
                     , successCallback?: SuccessCallback
                     , errorCallback?: ErrorCallback) {

        const setPropertiesRequest = new QueueSetPropertiesRequest();
        setPropertiesRequest.repeatMode = repeatMode;

        this.#sendMediaMessage(
                { ...setPropertiesRequest, type: "QUEUE_UPDATE" })
            .then(successCallback)
            .catch(errorCallback);
    }

    queueUpdateItems(queueUpdateItemsRequest: QueueUpdateItemsRequest
                  , successCallback?: SuccessCallback
                  , errorCallback?: ErrorCallback) {

        this.#sendMediaMessage(
                { ...queueUpdateItemsRequest, type: "QUEUE_UPDATE" })
            .then(successCallback)
            .catch(errorCallback);
    }

    removeUpdateListener(listener: UpdateListener) {
        this.#updateListeners.delete(listener);
    }

    seek(seekRequest: SeekRequest
       , successCallback?: SuccessCallback
       , errorCallback?: ErrorCallback) {

        this.#sendMediaMessage(
                { type: "SEEK", ...seekRequest })
            .then(successCallback)
            .catch(errorCallback);
    }

    setVolume(volumeRequest: VolumeRequest
            , successCallback?: SuccessCallback
            , errorCallback?: ErrorCallback) {
        
            this.#sendMediaMessage(
                    { type: "MEDIA_SET_VOLUME", ...volumeRequest })
                .then(successCallback)
                .catch(errorCallback);
    }

    stop(stopRequest?: StopRequest
       , successCallback?: SuccessCallback
       , errorCallback?: ErrorCallback) {

        if (!stopRequest) {
            stopRequest = new StopRequest();
        }

        this.#sendMediaMessage({
            type: "STOP"
          , ...stopRequest
        }).then(() => {
            this.#isActive = false;
            this.#listener.disconnect();

            if (successCallback) {
                successCallback();
            }
        }).catch(errorCallback);
    }

    supportsCommand(command: string): boolean {
        return this.supportedMediaCommands.includes(command);
    }


    #sendMediaMessage = async (
            // Allow messages without requestId
            message: Omit<SenderMediaMessage, "requestId">
                  & { requestId?: Nullable<number> }) => {

        if (!this.media) {
            return;
        }

        // TODO: Handle this and other errors better
        if (!this.#isActive) {
            throw new _Error(ErrorCode.SESSION_ERROR
                , "INVALID_MEDIA_SESSION_ID"
                , {
                    type: "INVALID_REQUEST"
                , reason: "INVALID_MEDIA_SESSION_ID"
                });

            return;
        }

        return new Promise<void>((resolve, reject) => {
            const messageId = uuid();

            this.#sendMediaMessageCallbacks.set(messageId, [
                resolve, reject
            ]);

            sendMessageResponse({
                subject: "bridge:media/sendMediaMessage"
              , data: {
                    message: {
                        // Default properties
                        requestId: 0
                      , mediaSessionId: this.mediaSessionId
                      , ...message
                    }
                  , messageId
                  , _id: this.#id
                }
            });
        });
    }
}
