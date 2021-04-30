"use strict";

import { Channel, Client } from "castv2";

import { Message } from "../../messaging";
import { sendMessage } from "../../lib/nativeMessaging";

import { ReceiverApplication, ReceiverMessage, SenderMessage } from "./types";


export const NS_CONNECTION = "urn:x-cast:com.google.cast.tp.connection";
export const NS_HEARTBEAT = "urn:x-cast:com.google.cast.tp.heartbeat";
export const NS_RECEIVER = "urn:x-cast:com.google.cast.receiver";

const HEARTBEAT_INTERVAL = 5000;


export default class Session {
        private isSessionCreated = false;

    private client: Client;
    private clientId = `client-${Math.floor(Math.random() * 10e5)}`;
    private transportId?: string;

    public channelMap = new Map<string, Channel>();

    private platformConnection?: Channel;
    private platformHeartbeat?: Channel;
    private platformReceiver?: Channel;
    private platformHeartbeatIntervalId?: NodeJS.Timeout;

    private transportConnection?: Channel;
    private transportHeartbeat?: Channel;

    private app?: ReceiverApplication;

    constructor(
            public host: string
          , public port: number
          , private appId: string
          , private referenceId: string) {

        const client = new Client();
        
        client.on("error", err => {
            console.error(`castv2 error: ${err}`);
        });

        client.on("close", () => {
            // TODO: Don't send new data
            if (this.platformHeartbeatIntervalId) {
                clearInterval(this.platformHeartbeatIntervalId);
            }
        });

        client.connect({ host, port }, this.onConnect.bind(this));
        this.client = client;
    }

    public createChannel(namespace: string) {
        if (!this.channelMap.has(namespace)) {
            this.channelMap.set(namespace, this.client.createChannel(
                    this.clientId!, this.transportId!
                  , namespace, "JSON"));
        }
    }

    private establishSession(app: ReceiverApplication) {
        this.transportId = app.transportId;

        // Mesage channel to app
        this.transportConnection = this.client.createChannel(
                this.clientId, this.transportId, NS_CONNECTION, "JSON");
        this.transportHeartbeat = this.client.createChannel(
                this.clientId, this.transportId, NS_HEARTBEAT, "JSON");

        this.transportConnection.send({
            type: "CONNECT"
        });
    }

    private onConnect() {
        const sourceId = "sender-0";
        const destinationId = "receiver-0";

        this.platformConnection = this.client.createChannel(
                sourceId, destinationId, NS_CONNECTION, "JSON");
        this.platformHeartbeat = this.client.createChannel(
                sourceId, destinationId, NS_HEARTBEAT, "JSON");
        this.platformReceiver = this.client.createChannel(
                sourceId, destinationId, NS_RECEIVER, "JSON");

        this.platformConnection.send({ type: "CONNECT" });
        this.platformHeartbeat.send({ type: "PING" });

        this.platformHeartbeatIntervalId = setInterval(() => {
            this.platformHeartbeat?.send({ type: "PING" });

            if (this.transportHeartbeat) {
                this.transportHeartbeat.send({ type: "PING" });
            }
        }, HEARTBEAT_INTERVAL);

        this.platformReceiver.send({
            type: "LAUNCH"
          , appId: this.appId
          , requestId: 0
        });

        this.platformReceiver.on("message", (message: ReceiverMessage) => {
            switch (message.type) {
                case "RECEIVER_STATUS": {
                    const { status } = message;

                    if (status.applications) {
                        // TODO: Fix for multiple applications?
                        const app = status.applications[0];
                        
                        if (app.appId !== this.appId) {
                            this.sendMessage({
                                subject: "shim:session/stopped"
                            });

                            this.client.close();
                            return;
                        }

                        if (!this.isSessionCreated) {
                            this.isSessionCreated = true;
                            this.establishSession(app);
                        }
                    }

                    this.sendMessage({
                        subject: "shim:session/updateStatus"
                      , data: { status: message.status }
                    });

                    break;
                }

                default: {
                    console.error(message);
                }
            }
        });
    }

    public messageHandler(message: Message) {
        switch (message.subject) {
            case "bridge:session/close": {
                this.close();
                break;
            }

            case "bridge:session/impl_addMessageListener": {
                this._impl_addMessageListener(message.data.namespace);
                break;
            }

            case "bridge:session/impl_sendMessage": {
                this._impl_sendMessage(
                        message.data.namespace
                      , message.data.message
                      , message.data.messageId);
                break;
            }
            case "bridge:session/impl_sendReceiverMessage": {
                const { message: receiverMessage
                      , messageId: receiverMessageId } = message.data;

                this.impl_sendReceiverMessage(
                        receiverMessage, receiverMessageId);

                break;
            }
        }
    }

    public close() {
        this.platformConnection?.send({ type: "CLOSE" });
        this.transportConnection?.send({ type: "CLOSE" });
    }

    public stop() {
        this.platformConnection?.send({ type: "STOP" });
    }

    private sendMessage(message: Message) {
        (message.data as any)._id = this.referenceId;
        sendMessage(message);
    }

    private _impl_addMessageListener(namespace: string) {
        // TODO: Limit to one listener per namespace
        this.createChannel(namespace);
        this.channelMap.get(namespace)?.on("message", (message: any) => {
            this.sendMessage({
                subject: "shim:session/impl_addMessageListener"
              , data: {
                    namespace
                  , message: JSON.stringify(message)
                }
            });
        });
    }

    private _impl_sendMessage(
            namespace: string
          , message: object | string
          , messageId: string) {

        let wasError = false;

        try {
            // Decode string messages
            if (typeof message === "string") {
                message = JSON.parse(message);
            }

            this.createChannel(namespace);
            this.channelMap.get(namespace)?.send(message);
        } catch (err) {
            wasError = true;
        }

        this.sendMessage({
            subject: "shim:session/impl_sendMessage"
          , data: { messageId, wasError }
        });
    }

    private impl_sendReceiverMessage(
            message: SenderMessage
          , messageId: string) {

        let wasError = false;
        try {
            this.platformReceiver?.send(message);
        } catch (err) {
            wasError = true;
        }

        // Handle stop message
        if (message.type === "STOP") {
            this.client.close();
        }

        this.sendMessage({
            subject: "shim:session/impl_sendReceiverMessage"
          , data: { messageId, wasError }
        });
    }

}
