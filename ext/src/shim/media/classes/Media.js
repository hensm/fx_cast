"use strict";


import Volume from "../../cast/classes/Volume";

import { PlayerState
       , RepeatMode
       , MediaCommand } from "../enums";

import _Error from "../../cast/classes/Error";
import { ErrorCode } from "../../cast/enums";

import { onMessage, sendMessage } from "../../messageBridge";

import uuid from "uuid/v1";


export default class Media {
    constructor (sessionId, mediaSessionId, _internalSessionId) {
        this._id = uuid();

        this.activeTrackIds = null;
        this.currentItemId = null;
        this.customData = null;
        this.currentTime = 0;
        this.idleReason = null;
        this.items = null;
        this.loadingItemId = null;
        this.media = null;
        this.mediaSessionId = mediaSessionId;
        this.playbackRate = 1;
        this.playerState = PlayerState.IDLE;
        this.preloadedItemId = null;
        this.repeatMode = RepeatMode.OFF;
        this.sessionId = sessionId;
        this.supportedMediaCommands = [];
        this.volume = new Volume();

        this._sendMessage("bridge:bridgemedia/initialize", {
            sessionId
          , mediaSessionId
          , _internalSessionId
        });

        onMessage(message => {
            if (!message._id || message._id !== this._id) {
                return;
            }

            switch (message.subject) {
                case "shim:media/update":
                    const status = message.data;
                    this.currentTime = status.currentTime;
                    this._lastCurrentTime = status._lastCurrentTime;
                    this.customData = status.customData;
                    this.volume = new Volume(
                            status._volumeLevel
                          , status._volumeMuted);
                    this.playbackRate = status.playbackRate;
                    this.playerState = status.playerState;
                    this.repeatMode = status.repeatMode;

                    if (status.media) {
                        this.media = status.media;
                    }
                    if (status.mediaSessionId) {
                        this.mediaSessionId = status.mediaSessionId;
                    }

                    // Call update listeners
                    this._updateListeners.forEach(listener => listener(true));

                    break;

                case "shim:media/sendMediaMessageResponse":
                    const { messageId, error } = message.data;
                    const [ successCallback, errorCallback ]
                            = this._sendMediaMessageCallbacks.get(messageId);

                    if (error && errorCallback) {
                        errorCallback(new _Error(ErrorCode.SESSION_ERROR));
                    } else if (successCallback) {
                        successCallback();
                    }

                    break;

            }
        });

        this._updateListeners = new Set();
        this._sendMediaMessageCallbacks = new Map();
    }

    _sendMessage (subject, data) {
        sendMessage({
            subject
          , data
          , _id: this._id
        });
    }

    _sendMediaMessage (message, successCallback, errorCallback) {
        message.mediaSessionId = this.mediaSessionId;
        message.requestId = 0;
        message.sessionId = this.sessionId;
        message.customData = null;

        const messageId = uuid();

        this._sendMediaMessageCallbacks.set(messageId, [
            successCallback
          , errorCallback
        ]);

        this._sendMessage("bridge:bridgemedia/sendMediaMessage", {
            message
          , messageId
        });
    }

    addUpdateListener (listener) {
        this._updateListeners.add(listener);
    }
    editTracksInfo (editTracksInfoRequest, successCallback, errorCallback) {
        console.log("STUB :: Media#editTracksInfo");
    }
    getEstimatedTime () {
        if (!this.currentTime) return 0;
        return this.currentTime + ((Date.now() / 1000) - this._lastCurrentTime);
    }
    getStatus (getStatusRequest, successCallback, errorCallback) {
        this._sendMediaMessage({ type: "MEDIA_GET_STATUS" }
              , successCallback, errorCallback);
    }
    pause (pauseRequest, successCallback, errorCallback) {
        this._sendMediaMessage({ type: "PAUSE" }
              , successCallback, errorCallback);
    }
    play (playRequest, successCallback, errorCallback) {
        this._sendMediaMessage({ type: "PLAY" }
              , successCallback, errorCallback);
    }
    queueAppendItem (item, successCallback, errorCallback) {
        console.log("STUB :: Media#queueAppendItem");
    }
    queueInsertItems (queueInsertItemsRequest, successCallback, errorCallback) {
        console.log("STUB :: Media#queueInsertItems");
    }
    queueJumpToItem (itemId, successCallback, errorCallback) {
        console.log("STUB :: Media#queueJumpToItem");
    }
    queueMoveItemToNewIndex (itemId, newIndex, successCallback, errorCallback) {
        console.log("STUB :: Media#queueMoveItemToNewIndex");
    }
    queueNext (successCallback, errorCallback) {
        console.log("STUB :: Media#queueNext");
    }
    queuePrev (successCallback, errorCallback) {
        console.log("STUB :: Media#queuePrev");
    }
    queueRemoveItem(itemId, successCallback, errorCallback) {
        console.log("STUB :: Media#queueRemoveItem");
    }
    queueReorderItems (queueReorderItemsRequest, successCallback, errorCallback) {
        console.log("STUB :: Media#queueReorderItems");
    }
    queueSetRepeatMode (repeatMode, successCallback, errorCallback) {
        console.log("STUB :: Media#queueSetRepeatMode");
    }
    queueUpdateItems (queueUpdateItemsRequest, successCallback, errorCallback) {
        console.log("STUB :: Media#queueUpdateItems");
    }
    removeUpdateListener (listener) {
        this._updateListeners.delete(listener);
    }
    seek (seekRequest, successCallback, errorCallback) {
        console.log(seekRequest);
        this._sendMediaMessage({
                type: "SEEK"
              , currentTime: seekRequest.currentTime
          }, successCallback, errorCallback);
    }
    setVolume (volumeRequest, successCallback, errorCallback) {
        this._sendMediaMessage({
            type: "SET_VOLUME"
          , volume: volumeRequest.volume
        }, successCallback, errorCallback);
    }
    stop (stopRequest, successCallback, errorCallback) {
        this._sendMediaMessage({ type: "STOP" }
              , successCallback, errorCallback);
    }
    supportsCommand (command) {
        console.log("STUB :: Media#supportsCommand");
    }
}
