"use strict";

import logger from "../../../../lib/logger";

import uuid from "uuid/v1";

import BreakStatus from "./BreakStatus";
import EditTracksInfoRequest from "./EditTracksInfoRequest";
import GetStatusRequest from "./GetStatusRequest";
import LiveSeekableRange from "./LiveSeekableRange";
import MediaInfo from "./MediaInfo";
import PauseRequest from "./PauseRequest";
import PlayRequest from "./PlayRequest";
import QueueData from "./QueueData";
import QueueInsertItemsRequest from "./QueueInsertItemsRequest";
import QueueItem from "./QueueItem";
import QueueReorderItemsRequest from "./QueueReorderItemsRequest";
import QueueUpdateItemsRequest from "./QueueUpdateItemsRequest";
import SeekRequest from "./SeekRequest";
import StopRequest from "./StopRequest";
import VideoInformation from "./VideoInformation";
import VolumeRequest from "./VolumeRequest";

import Volume from "../../classes/Volume";

import { PlayerState
       , RepeatMode } from "../enums";

import _Error from "../../classes/Error";
import { ErrorCode } from "../../enums";

import { onMessage, sendMessageResponse } from "../../../eventMessageChannel";

import { Callbacks
       , ErrorCallback
       , SuccessCallback
       , UpdateListener } from "../../../types";


export default class Media {
    #id = uuid();
    #isActive = true;
    #updateListeners = new Set<UpdateListener>();
    #sendMediaMessageCallbacks = new Map<string, Callbacks>();
    #lastCurrentTime?: number;

    #listener = onMessage(message => {
        if ((message as any)._id !== this.#id) {
            return;
        }

        switch (message.subject) {
            case "shim:/media/update": {
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

            case "shim:/media/sendMediaMessageResponse": {
                const { messageId, error } = message.data;
                const [ successCallback, errorCallback ]
                        = this.#sendMediaMessageCallbacks
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
    public currentTime: number = 0;
    public idleReason: (string | null) = null;
    public items: (QueueItem[] | null) = null;
    public liveSeekableRange?: LiveSeekableRange;
    public loadingItemId: (number | null) = null;
    public media: (MediaInfo | null) = null;
    public playbackRate: number = 1;
    public playerState: string = PlayerState.IDLE;
    public preloadedItemId: (number | null) = null;
    public queueData?: QueueData;
    public repeatMode: string = RepeatMode.OFF;
    public supportedMediaCommands: string[] = [];
    public videoInfo?: VideoInformation;
    public volume: Volume = new Volume();


    constructor (
            public sessionId: string
          , public mediaSessionId: number
          , _internalSessionId: string) {

        sendMessageResponse({
            subject: "bridge:/media/initialize"
          , data: {
                sessionId
              , mediaSessionId
              , _internalSessionId
            }
          , _id: this.#id
        });
    }

    public addUpdateListener (listener: UpdateListener): void {
        this.#updateListeners.add(listener);
    }

    public editTracksInfo (
            _editTracksInfoRequest: EditTracksInfoRequest
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {

        logger.info("STUB :: Media#editTracksInfo");
    }

    public getEstimatedBreakClipTime () {
        logger.info("STUB :: Media#getEstimatedBreakClipTime");
    }
    public getEstimatedBreakTime () {
        logger.info("STUB :: Media#getEstimatedBreakTime");
    }
    public getEstimatedLiveSeekableRange () {
        logger.info("STUB :: Media#getEstimatedLiveSeekableRange");
    }

    public getEstimatedTime (): number {
        if (this.currentTime === undefined
         || this.#lastCurrentTime === undefined) {
            return 0;
        }

        return this.currentTime + ((Date.now() / 1000) - this.#lastCurrentTime);
    }

    public getStatus (
            _getStatusRequest?: GetStatusRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage({ type: "MEDIA_GET_STATUS" }
              , successCallback, errorCallback);
    }

    public pause (
            _pauseRequest?: PauseRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage({ type: "PAUSE" }
              , successCallback, errorCallback);
    }

    public play (
            _playRequest?: PlayRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage({ type: "PLAY" }
              , successCallback, errorCallback);
    }

    public queueAppendItem (
            _item: QueueItem
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        logger.info("STUB :: Media#queueAppendItem");
    }

    public queueInsertItems (
            _queueInsertItemsRequest: QueueInsertItemsRequest
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        logger.info("STUB :: Media#queueInsertItems");
    }

    public queueJumpToItem (
            _itemId: number
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        logger.info("STUB :: Media#queueJumpToItem");
    }

    public queueMoveItemToNewIndex (
            _itemId: number
          , _newIndex: number
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        logger.info("STUB :: Media#queueMoveItemToNewIndex");
    }

    public queueNext (
            _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        logger.info("STUB :: Media#queueNext");
    }

    public queuePrev (
            _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        logger.info("STUB :: Media#queuePrev");
    }

    public queueRemoveItem (
            _itemId: number
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        logger.info("STUB :: Media#queueRemoveItem");
    }

    public queueReorderItems (
            _queueReorderItemsRequest: QueueReorderItemsRequest
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        logger.info("STUB :: Media#queueReorderItems");
    }

    public queueSetRepeatMode (
            _repeatMode: string
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        logger.info("STUB :: Media#queueSetRepeatMode");
    }

    public queueUpdateItems (
            _queueUpdateItemsRequest: QueueUpdateItemsRequest
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        logger.info("STUB :: Media#queueUpdateItems");
    }

    public removeUpdateListener (listener: UpdateListener) {
        this.#updateListeners.delete(listener);
    }

    public seek (
            seekRequest: SeekRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage({
            type: "SEEK"
          , currentTime: seekRequest.currentTime
        }, successCallback, errorCallback);
    }

    public setVolume (
            volumeRequest: VolumeRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage({
            type: "SET_VOLUME"
          , volume: volumeRequest.volume
        }, successCallback, errorCallback);
    }

    public stop (
            _stopRequest: StopRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage(
                { type: "STOP" }
              , () => {
                    this.#isActive = false;
                    this.#listener.disconnect();

                    if (successCallback) {
                        successCallback();
                    }
                }
              , errorCallback);
    }

    public supportsCommand (_command: string): boolean {
        logger.info("STUB :: Media#supportsCommand");
        return true;
    }


    public _sendMediaMessage (
            message: any
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

        message.mediaSessionId = this.mediaSessionId;
        message.requestId = 0;
        message.sessionId = this.sessionId;
        message.customData = null;

        const messageId = uuid();

        this.#sendMediaMessageCallbacks.set(messageId, [
            successCallback
          , errorCallback
        ]);

        sendMessageResponse({
            subject: "bridge:/media/sendMediaMessage"
          , data: {
                message
              , messageId
            }
          , _id: this.#id
        });
    }
}
