"use strict";

import { Channel } from "castv2";

import Session from "./Session";

import { Message
       , SendMessageCallback } from "./types";


const MEDIA_NAMESPACE = "urn:x-cast:com.google.cast.media";

export interface UpdateMessageData {
    _volumeLevel: number;
    _volumeMuted: boolean;
    _lastCurrentTime: number;
    currentTime: number;
    customData?: any;
    playbackRate: number;
    playerState: string;
    repeatMode?: string;
    media?: any;
    mediaSessionId?: number;
}


export default class Media {
    private sessionId: number;
    private mediaSessionId: number;
    private referenceId: string;
    private session: Session;
    private channel: Channel;
    private sendMessageCallback: SendMessageCallback;

    constructor (
            sessionId: number
          , mediaSessionId: number
          , referenceId: string
          , session: Session
          , sendMessageCallback: SendMessageCallback) {

        this.sessionId = sessionId;
        this.mediaSessionId = mediaSessionId;
        this.referenceId = referenceId;
        this.session = session;
        this.sendMessageCallback = sendMessageCallback;

        this.session.createChannel(MEDIA_NAMESPACE);
        this.channel = this.session.channelMap.get(MEDIA_NAMESPACE)!;

        this.channel.on("message", (data: any) => {
            if (data && data.type === "MEDIA_STATUS"
                    && data.status && data.status.length > 0) {

                const status = data.status[0];

                const messageData = {
                    _lastCurrentTime: Date.now() / 1000

                  , currentTime: status.currentTime
                  , customData: status.customData
                  , playbackRate: status.playbackRate
                  , playerState: status.playerState
                  , repeatMode: status.repeatMode
                } as UpdateMessageData;

                if (status.volume) {
                    messageData._volumeLevel = status.volume.level
                    messageData._volumeMuted = status.volume.muted
                }

                if (status.media) {
                    messageData.media = status.media;
                }
                if (status.mediaSessionId) {
                    messageData.mediaSessionId = status.mediaSessionId;
                }

                this.sendMessage("shim:/media/update", messageData);

                // Update ID
                if (status.mediaSessionId) {
                    this.mediaSessionId = status.mediaSessionId;
                }
            }
        });
    }

    public messageHandler (message: Message) {
        switch (message.subject) {
            case "bridge:/media/sendMediaMessage": {
                let error = false;
                try {
                    this.channel.send(message.data.message);
                } catch (err) {
                    error = true;
                }

                this.sendMessage("shim:/media/sendMediaMessageResponse", {
                    messageId: message.data.messageId
                  , error
                });

                break;
            }
        }
    }

    private sendMessage (subject: string, data: any = {}) {
        this.sendMessageCallback({
            subject
          , data
          , _id: this.referenceId
        });
    }
}
