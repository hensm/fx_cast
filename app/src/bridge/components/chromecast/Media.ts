"use strict";

import castv2 from "castv2";

import Session from "./Session";

import { Message } from "../../types";
import { sendMessage } from "../../lib/messaging"


const NS_MEDIA = "urn:x-cast:com.google.cast.media";

export interface UpdateMessageData {
    _volumeLevel?: number;
    _volumeMuted?: boolean;
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
    private channel: castv2.Channel;

    constructor (
            private referenceId: string
          , private session: Session) {

        this.session.createChannel(NS_MEDIA);
        this.channel = this.session.channelMap.get(NS_MEDIA)!;

        this.channel.on("message", (data: any) => {
            if (data && data.type === "MEDIA_STATUS"
                    && data.status && data.status.length > 0) {

                const status = data.status[0];

                const messageData: UpdateMessageData = {
                    _lastCurrentTime: Date.now() / 1000

                  , currentTime: status.currentTime
                  , customData: status.customData
                  , playbackRate: status.playbackRate
                  , playerState: status.playerState
                  , repeatMode: status.repeatMode
                };

                if (status.volume) {
                    messageData._volumeLevel = status.volume.level;
                    messageData._volumeMuted = status.volume.muted;
                }

                if (status.media) {
                    messageData.media = status.media;
                }
                if (status.mediaSessionId) {
                    messageData.mediaSessionId = status.mediaSessionId;
                }

                this.sendMessage("shim:/media/update", messageData);
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

    private sendMessage (subject: string, data: any) {
        data._id = this.referenceId;
        (sendMessage as any)({
            subject
          , data
        });
    }
}
