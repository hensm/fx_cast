"use strict";

import uuid from "uuid/v1";

import EditTracksInfoRequest from "./EditTracksInfoRequest";
import GetStatusRequest from "./GetStatusRequest";
import MediaInfo from "./MediaInfo";
import PauseRequest from "./PauseRequest";
import PlayRequest from "./PlayRequest";
import QueueInsertItemsRequest from "./QueueInsertItemsRequest";
import QueueItem from "./QueueItem";
import QueueReorderItemsRequest from "./QueueReorderItemsRequest";
import QueueUpdateItemsRequest from "./QueueUpdateItemsRequest";
import SeekRequest from "./SeekRequest";
import StopRequest from "./StopRequest";
import VolumeRequest from "./VolumeRequest";

import Volume from "../../classes/Volume";

import { PlayerState
       , RepeatMode } from "../enums";

import _Error from "../../classes/Error";
import { ErrorCode } from "../../enums";

import { onMessage, sendMessageResponse } from "../../../eventMessageChannel";

import { CallbacksMap
       , ErrorCallback
       , SuccessCallback
       , UpdateListener } from "../../../types";


const _id = new WeakMap<Media, string>();

const _updateListeners = new WeakMap<Media, Set<UpdateListener>>();
const _sendMediaMessageCallbacks = new WeakMap<Media, CallbacksMap>();

const _lastCurrentTime = new WeakMap<Media, number>();


export default class Media {
    public activeTrackIds: number[] = null;
    public currentItemId: number = null;
    public customData: any = null;
    public currentTime: number = 0;
    public idleReason: string = null;
    public items: QueueItem[] = null;
    public loadingItemId: number = null;
    public media: MediaInfo = null;
    public playbackRate: number = 1;
    public playerState: string = PlayerState.IDLE;
    public preloadedItemId: number = null;
    public repeatMode: string = RepeatMode.OFF;
    public supportedMediaCommands: string[] = [];
    public volume: Volume = new Volume();


    constructor (
            public sessionId: string
          , public mediaSessionId: number
          , _internalSessionId: string) {

        _id.set(this, uuid());

        _updateListeners.set(this, new Set());
        _sendMediaMessageCallbacks.set(this, new Map());

        _lastCurrentTime.set(this, undefined);


        sendMessageResponse({
            subject: "bridge:/media/initialize"
          , data: {
                sessionId
              , mediaSessionId
              , _internalSessionId
            }
          , _id: _id.get(this)
        });

        onMessage(message => {
            if (!message._id || message._id !== _id.get(this)) {
                return;
            }

            switch (message.subject) {
                case "shim:/media/update": {
                    const status = message.data;

                    this.currentTime = status.currentTime;
                    _lastCurrentTime.set(this, status._lastCurrentTime);
                    this.customData = status.customData;
                    this.playbackRate = status.playbackRate;
                    this.playerState = status.playerState;
                    this.repeatMode = status.repeatMode;

                    if (status.volume) {
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
                    for (const listener of _updateListeners.get(this)) {
                        listener(true);
                    }

                    break;
                }

                case "shim:/media/sendMediaMessageResponse": {
                    const { messageId, error } = message.data;
                    const [ successCallback, errorCallback ]
                            = _sendMediaMessageCallbacks
                                .get(this)
                                .get(messageId);

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else if (successCallback) {
                        successCallback();
                    }

                    break;
                }

            }
        });
    }

    public addUpdateListener (listener: UpdateListener): void {
        _updateListeners.get(this).add(listener);
    }

    public editTracksInfo (
            _editTracksInfoRequest: EditTracksInfoRequest
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {

        console.info("STUB :: Media#editTracksInfo");
    }

    public getEstimatedTime (): number {
        if (!this.currentTime) {
            return 0;
        }

        return this.currentTime
                + ((Date.now() / 1000) - _lastCurrentTime.get(this));
    }

    public getStatus (
            _getStatusRequest?: GetStatusRequest
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback): void {

        this._sendMediaMessage({ type: "MEDIA_GET_STATUS" }
              , successCallback, errorCallback);
    }

    public pause (
            _pauseRequest: PauseRequest
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
        console.info("STUB :: Media#queueAppendItem");
    }

    public queueInsertItems (
            _queueInsertItemsRequest: QueueInsertItemsRequest
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        console.info("STUB :: Media#queueInsertItems");
    }

    public queueJumpToItem (
            _itemId: number
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        console.info("STUB :: Media#queueJumpToItem");
    }

    public queueMoveItemToNewIndex (
            _itemId: number
          , _newIndex: number
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        console.info("STUB :: Media#queueMoveItemToNewIndex");
    }

    public queueNext (
            _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        console.info("STUB :: Media#queueNext");
    }

    public queuePrev (
            _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        console.info("STUB :: Media#queuePrev");
    }

    public queueRemoveItem (
            _itemId: number
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        console.info("STUB :: Media#queueRemoveItem");
    }

    public queueReorderItems (
            _queueReorderItemsRequest: QueueReorderItemsRequest
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        console.info("STUB :: Media#queueReorderItems");
    }

    public queueSetRepeatMode (
            _repeatMode: string
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        console.info("STUB :: Media#queueSetRepeatMode");
    }

    public queueUpdateItems (
            _queueUpdateItemsRequest: QueueUpdateItemsRequest
          , _successCallback?: SuccessCallback
          , _errorCallback?: ErrorCallback): void {
        console.info("STUB :: Media#queueUpdateItems");
    }

    public removeUpdateListener (listener: UpdateListener) {
        _updateListeners.get(this).delete(listener);
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

        this._sendMediaMessage({
            type: "STOP"
        }, successCallback, errorCallback);
    }

    public supportsCommand (_command: string): boolean {
        console.info("STUB :: Media#supportsCommand");
        return true;
    }


    public _sendMediaMessage (
            message: any
          , successCallback?: SuccessCallback
          , errorCallback?: ErrorCallback) {

        message.mediaSessionId = this.mediaSessionId;
        message.requestId = 0;
        message.sessionId = this.sessionId;
        message.customData = null;

        const messageId = uuid();

        _sendMediaMessageCallbacks.get(this).set(messageId, [
            successCallback
          , errorCallback
        ]);

        sendMessageResponse({
            subject: "bridge:/media/sendMediaMessage"
          , data: {
                message
              , messageId
            }
          , _id: _id.get(this)
        });
    }
}
