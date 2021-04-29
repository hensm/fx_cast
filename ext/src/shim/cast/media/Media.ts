"use strict";

import logger from "../../../lib/logger";

import { v1 as uuid } from "uuid";

import { BreakStatus
       , EditTracksInfoRequest
       , GetStatusRequest
       , LiveSeekableRange
       , MediaInfo
       , PauseRequest
       , PlayRequest
       , QueueData
       , QueueJumpRequest
       , QueueInsertItemsRequest
       , QueueItem
       , QueueSetPropertiesRequest
       , QueueRemoveItemsRequest
       , QueueReorderItemsRequest
       , QueueUpdateItemsRequest
       , SeekRequest
       , StopRequest
       , VideoInformation
       , VolumeRequest } from "./dataClasses";

import { Volume, Error as _Error } from "../dataClasses";

import { PlayerState
       , RepeatMode } from "./enums";

import { ErrorCode } from "../enums";

import { onMessage, sendMessageResponse } from "../../eventMessageChannel";

import { Callbacks
       , ErrorCallback
       , SuccessCallback
       , UpdateListener } from "../../types";

import { SessionMediaMessage } from "../../../types";


export default class Media {
    #id = uuid();
    #isActive = true;
    #updateListeners = new Set<UpdateListener>();
    #sendMediaMessageCallbacks = new Map<string, Callbacks>();
    #lastCurrentTime = 0;

    #listener = onMessage(message => {
        if ((message as any).data._id !== this.#id) {
            return;
        }

        switch (message.subject) {
            case "shim:media/update": {
                const status = message.data;

                this.currentTime = status.currentTime;
                this.#lastCurrentTime = status._lastCurrentTime;
                this.customData = status.customData;
                this.playbackRate = status.playbackRate;
                this.playerState = status.playerState;
                this.repeatMode = status.repeatMode;

                if (status._volumeLevel && status._volumeMuted) {
                    this.volume = new Volume(
                            status._volumeLevel
                          , status._volumeMuted);
                }

                if (status.media) {
                    this.media = status.media;
                }
                if (status.mediaSessionId) {
                    this.mediaSessionId = status.mediaSessionId;
                }

                // Call update listeners
                for (const listener of this.#updateListeners) {
                    listener(true);
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

    public activeTrackIds: (number[] | null) = null;
    public breakStatus?: BreakStatus;
    public currentItemId: (number | null) = null;
    public customData: any = null;
    public currentTime = 0;
    public idleReason: (string | null) = null;
    public items: (QueueItem[] | null) = null;
    public liveSeekableRange?: LiveSeekableRange;
    public loadingItemId: (number | null) = null;
    public media: (MediaInfo | null) = null;
    public playbackRate = 1;
    public playerState: string = PlayerState.IDLE;
    public preloadedItemId: (number | null) = null;
    public queueData?: QueueData;
    public repeatMode: string = RepeatMode.OFF;
    public supportedMediaCommands: string[] = [];
    public videoInfo?: VideoInformation;
    public volume: Volume = new Volume();


    constructor(
            public sessionId: string
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

    public addUpdateListener(listener: UpdateListener): void {
        this.#updateListeners.add(listener);
    }

    public editTracksInfo(
            editTracksInfoRequest: EditTracksInfoRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this.#sendMediaMessage(
                { type: "EDIT_TRACKS_INFO", ...editTracksInfoRequest })
            .then(successCallback)
            .catch(errorCallback);
    }

    public getEstimatedBreakClipTime() {
        logger.info("STUB :: Media#getEstimatedBreakClipTime");
    }
    public getEstimatedBreakTime() {
        logger.info("STUB :: Media#getEstimatedBreakTime");
    }
    public getEstimatedLiveSeekableRange() {
        logger.info("STUB :: Media#getEstimatedLiveSeekableRange");
    }

    public getEstimatedTime(): number {
        if (this.playerState === PlayerState.PLAYING) {
            let estimatedTime = this.currentTime + (this.playbackRate * (
                    Date.now() - this.#lastCurrentTime) / 1000);

            // Enforce valid range
            if (this.media?.duration && estimatedTime > this.media.duration) {
                estimatedTime = this.media.duration;
            } else if (estimatedTime < 0) {
                estimatedTime = 0;
            }

            return estimatedTime;
        }

        return this.currentTime;
    }

    public getStatus(
            getStatusRequest?: GetStatusRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
        if (!getStatusRequest) {
            getStatusRequest = new GetStatusRequest();
        }
        
        this.#sendMediaMessage(
                { type: "MEDIA_GET_STATUS", ...getStatusRequest })
            .then(successCallback)
            .catch(errorCallback);
    }

    public pause(
            pauseRequest?: PauseRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        if (!pauseRequest) {
            pauseRequest = new PauseRequest();
        }

        this.#sendMediaMessage(
                { type: "PAUSE", ...pauseRequest })
            .then(successCallback)
            .catch(errorCallback);
    }

    public play(
            playRequest?: PlayRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        if (!playRequest) {
            playRequest = new PlayRequest();
        }

        this.#sendMediaMessage(
                { type: "PLAY", ...playRequest })
            .then(successCallback)
            .catch(errorCallback);
    }

    public queueAppendItem(
            item: QueueItem
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
        this.#sendMediaMessage(new QueueInsertItemsRequest([ item ]))
            .then(successCallback)
            .catch(errorCallback);
    }

    public queueInsertItems(
            queueInsertItemsRequest: QueueInsertItemsRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this.#sendMediaMessage(queueInsertItemsRequest)
            .then(successCallback)
            .catch(errorCallback);
        
    }

    public queueJumpToItem(
            itemId: number
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        if (this.items?.find(item => item.itemId === itemId)) {
            const jumpRequest = new QueueJumpRequest();
            jumpRequest.currentItemId = itemId;

            this.#sendMediaMessage(jumpRequest)
                .then(successCallback)
                .catch(errorCallback);
        }
    }

    public queueMoveItemToNewIndex(
            itemId: number
          , newIndex: number
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

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

            this.#sendMediaMessage(reorderItemsRequest)
                .then(successCallback)
                .catch(errorCallback);
        }
    }

    public queueNext(
            successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        const jumpRequest = new QueueJumpRequest();
        jumpRequest.jump = 1;

        this.#sendMediaMessage(jumpRequest)
            .then(successCallback)
            .catch(errorCallback);
    }

    public queuePrev(
            successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        const jumpRequest = new QueueJumpRequest();
        jumpRequest.jump = -1;

        this.#sendMediaMessage(jumpRequest)
            .then(successCallback)
            .catch(errorCallback);
    }

    public queueRemoveItem(
            itemId: number
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
        const item = this.items?.find(item => item.itemId === itemId);
        if (item) {
            const queueRemoveItemsRequest =
                    new QueueRemoveItemsRequest([ itemId ]);

            this.#sendMediaMessage(queueRemoveItemsRequest)
                    .then(successCallback)
                    .catch(errorCallback);
        }
    }

    public queueRemoveItems(
            queueRemoveItemsRequest: QueueRemoveItemsRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
            this.#sendMediaMessage(queueRemoveItemsRequest)
                .then(successCallback)
                .catch(errorCallback);
    }

    public queueReorderItems(
            queueReorderItemsRequest: QueueReorderItemsRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this.#sendMediaMessage(queueReorderItemsRequest)
            .then(successCallback)
            .catch(errorCallback);
    }

    public queueSetRepeatMode(
            repeatMode: string
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
        const setPropertiesRequest = new QueueSetPropertiesRequest();
        setPropertiesRequest.repeatMode = repeatMode;

        this.#sendMediaMessage(setPropertiesRequest)
            .then(successCallback)
            .catch(errorCallback);
    }

    public queueUpdateItems(
            queueUpdateItemsRequest: QueueUpdateItemsRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this.#sendMediaMessage(queueUpdateItemsRequest)
            .then(successCallback)
            .catch(errorCallback);
    }

    public removeUpdateListener(listener: UpdateListener) {
        this.#updateListeners.delete(listener);
    }

    public seek(
            seekRequest: SeekRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this.#sendMediaMessage(
                { type: "SEEK", ...seekRequest })
            .then(successCallback)
            .catch(errorCallback);
    }

    public setVolume(
            volumeRequest: VolumeRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
            this.#sendMediaMessage(
                    { type: "MEDIA_SET_VOLUME", ...volumeRequest })
                .then(successCallback)
                .catch(errorCallback);
    }

    public stop(
            stopRequest?: StopRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

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

    public supportsCommand(command: string): boolean {
        return this.supportedMediaCommands.includes(command);
    }


    #sendMediaMessage = async (message: SessionMediaMessage) => {
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
            // TODO: Look at this again
            (message as any).mediaSessionId = this.mediaSessionId;
            (message as any).requestId = 0;
            (message as any).sessionId = this.sessionId;

            const messageId = uuid();

            this.#sendMediaMessageCallbacks.set(messageId, [
                resolve, reject
            ]);

            sendMessageResponse({
                subject: "bridge:media/sendMediaMessage"
            , data: {
                    message
                , messageId
                , _id: this.#id
                }
            });
        });
    }
}
