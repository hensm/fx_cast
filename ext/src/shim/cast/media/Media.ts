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


type MediaRequest =
        EditTracksInfoRequest
      | GetStatusRequest
      | PauseRequest
      | PlayRequest
      | QueueInsertItemsRequest
      | QueueJumpRequest
      | QueueRemoveItemsRequest
      | QueueReorderItemsRequest
      | QueueUpdateItemsRequest
      | SeekRequest
      | StopRequest
      | VolumeRequest;

enum MediaMessageType {
    Play = "PLAY"
  , Load = "LOAD"
  , Pause = "PAUSE"
  , Seek = "SEEK"
  , Stop = "STOP"
  , MediaSetVolume = "MEDIA_SET_VOLUME"
  , MediaGetStatus = "MEDIA_GET_STATUS"
  , EditTracksInfo = "EDIT_TRACKS_INFO"
  , QueueLoad = "QUEUE_LOAD"
  , QueueInsert = "QUEUE_INSERT"
  , QueueUpdate = "QUEUE_UPDATE"
  , QueueRemove = "QUEUE_REMOVE"
  , QueueReorder = "QUEUE_REORDER"
}


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

        this._sendMediaMessage(
                MediaMessageType.EditTracksInfo
              , editTracksInfoRequest
              , successCallback, errorCallback);
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
        
        this._sendMediaMessage(
                MediaMessageType.MediaGetStatus
              , getStatusRequest
              , successCallback, errorCallback);
    }

    public pause(
            pauseRequest?: PauseRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        if (!pauseRequest) {
            pauseRequest = new PauseRequest();
        }

        this._sendMediaMessage(
                MediaMessageType.Pause
              , pauseRequest
              , successCallback, errorCallback);
    }

    public play(
            playRequest?: PlayRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        if (!playRequest) {
            playRequest = new PlayRequest();
        }

        this._sendMediaMessage(
                MediaMessageType.Play
              , playRequest
              , successCallback, errorCallback);
    }

    public queueAppendItem(
            item: QueueItem
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
        this._sendMediaMessage(
                MediaMessageType.QueueInsert
              , new QueueInsertItemsRequest([ item ])
              , successCallback, errorCallback);
    }

    public queueInsertItems(
            queueInsertItemsRequest: QueueInsertItemsRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage(
                MediaMessageType.QueueInsert
              , queueInsertItemsRequest
              , successCallback, errorCallback);
    }

    public queueJumpToItem(
            itemId: number
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        if (this.items?.find(item => item.itemId === itemId)) {
            const jumpRequest = new QueueJumpRequest();
            jumpRequest.currentItemId = itemId;

            this._sendMediaMessage(
                    MediaMessageType.QueueUpdate
                  , jumpRequest
                  , successCallback, errorCallback);
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

            this._sendMediaMessage(
                    MediaMessageType.QueueReorder
                  , reorderItemsRequest
                  , successCallback, errorCallback);
        }
    }

    public queueNext(
            successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        const jumpRequest = new QueueJumpRequest();
        jumpRequest.jump = 1;

        this._sendMediaMessage(
                MediaMessageType.QueueUpdate
              , jumpRequest
              , successCallback, errorCallback);
    }

    public queuePrev(
            successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        const jumpRequest = new QueueJumpRequest();
        jumpRequest.jump = -1;

        this._sendMediaMessage(
                MediaMessageType.QueueUpdate
              , jumpRequest
              , successCallback, errorCallback);
    }

    public queueRemoveItem(
            itemId: number
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
        const item = this.items?.find(item => item.itemId === itemId);
        if (item) {
            const removeItemsRequest = new QueueRemoveItemsRequest([ itemId ]);
            this._sendMediaMessage(
                    MediaMessageType.QueueRemove
                  , removeItemsRequest
                  , successCallback, errorCallback);
        }
    }

    public queueRemoveItems(
            queueRemoveItemsRequest: QueueRemoveItemsRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
        this._sendMediaMessage(
                MediaMessageType.QueueRemove
              , queueRemoveItemsRequest
              , successCallback, errorCallback);
    }

    public queueReorderItems(
            queueReorderItemsRequest: QueueReorderItemsRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage(
                MediaMessageType.QueueReorder
              , queueReorderItemsRequest
              , successCallback, errorCallback);
    }

    public queueSetRepeatMode(
            repeatMode: string
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
        const setPropertiesRequest = new QueueSetPropertiesRequest();
        setPropertiesRequest.repeatMode = repeatMode;

        this._sendMediaMessage(
                MediaMessageType.QueueUpdate
              , setPropertiesRequest
              , successCallback, errorCallback);
    }

    public queueUpdateItems(
            queueUpdateItemsRequest: QueueUpdateItemsRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage(
                MediaMessageType.QueueUpdate
              , queueUpdateItemsRequest
              , successCallback, errorCallback);
    }

    public removeUpdateListener(listener: UpdateListener) {
        this.#updateListeners.delete(listener);
    }

    public seek(
            seekRequest: SeekRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        
        this._sendMediaMessage(
                MediaMessageType.Seek
              , seekRequest
              , successCallback, errorCallback);
    }

    public setVolume(
            volumeRequest: VolumeRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {
        
        
        this._sendMediaMessage(
                MediaMessageType.MediaSetVolume
              , volumeRequest
              , successCallback, errorCallback);
    }

    public stop(
            stopRequest?: StopRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        if (!stopRequest) {
            stopRequest = new StopRequest();
        }

        this._sendMediaMessage(
                MediaMessageType.Stop
              , stopRequest
              , () => {
                    this.#isActive = false;
                    this.#listener.disconnect();

                    if (successCallback) {
                        successCallback();
                    }
                }
              , errorCallback);
    }

    public supportsCommand(command: string): boolean {
        return this.supportedMediaCommands.includes(command);
    }


    public _sendMediaMessage(
            messageType: string
          , message: MediaRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback) {

        // TODO: Handle this and other errors better
        if (!this.#isActive) {
            if (errorCallback) {
                errorCallback(new _Error(ErrorCode.SESSION_ERROR
                    , "INVALID_MEDIA_SESSION_ID"
                    , {
                        type: "INVALID_REQUEST"
                      , reason: "INVALID_MEDIA_SESSION_ID"
                    }));
            }

            return;
        }

        // TODO: Fix this
        (message as any).type = messageType;

        (message as any).mediaSessionId = this.mediaSessionId;
        (message as any).requestId = 0;
        (message as any).sessionId = this.sessionId;
        (message as any).customData = null;

        const messageId = uuid();

        this.#sendMediaMessageCallbacks.set(messageId, [
            successCallback
          , errorCallback
        ]);

        sendMessageResponse({
            subject: "bridge:media/sendMediaMessage"
          , data: {
                message
              , messageId
              , _id: this.#id
            }
        });
    }
}
