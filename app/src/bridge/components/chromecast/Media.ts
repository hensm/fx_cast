"use strict";

import castv2 from "castv2";

import { ReceiverMediaMessage } from "./types";

import { Message } from "../../messaging";
import { sendMessage } from "../../lib/nativeMessaging";

import Session from "./Session";


const NS_MEDIA = "urn:x-cast:com.google.cast.media";


export default class Media {
    private channel: castv2.Channel;

    constructor(
            private referenceId: string
          , private session: Session) {

        // Ensure channel exists
        this.session.createChannel(NS_MEDIA);

        const channel = this.session.channelMap.get(NS_MEDIA);
        if (!channel) {
            throw new Error("Media message cannel not found");
        }

        this.channel = channel;
        this.channel.on("message", this.onMediaMessage);
    }

    private onMediaMessage = (message: ReceiverMediaMessage) => {
        switch (message.type) {
            case "MEDIA_STATUS": {
                // TODO: Fix for multiple media statuses
                const status = message.status[0];

                this.sendMessage({
                    subject: "shim:media/updateStatus"
                  , data: { status }
                });

                break;
            }
        }
    }

    public messageHandler(message: Message) {
        switch (message.subject) {
            case "bridge:media/sendMediaMessage": {
                let error = false;
                try {
                    this.channel.send(message.data.message);
                } catch (err) {
                    error = true;
                }

                this.sendMessage({
                    subject: "shim:media/sendMediaMessageResponse"
                  , data: {
                        messageId: message.data.messageId
                      , error
                    }
                });

                break;
            }
        }
    }

    private sendMessage(message: Message) {
        (message.data as any)._id = this.referenceId;
        sendMessage(message);
    }
}
