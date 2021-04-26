"use strict";

import { Channel, Client } from "castv2";

import { Message } from "../../messaging";
import { sendMessage } from "../../lib/nativeMessaging";


export const NS_CONNECTION = "urn:x-cast:com.google.cast.tp.connection";
export const NS_HEARTBEAT = "urn:x-cast:com.google.cast.tp.heartbeat";
export const NS_RECEIVER = "urn:x-cast:com.google.cast.receiver";

export default class Session {
    public channelMap = new Map<string, Channel>();

    private client: Client;
    private clientConnection?: Channel;
    private clientHeartbeat?: Channel;
    private clientReceiver?: Channel;
    private clientHeartbeatIntervalId?: NodeJS.Timeout;

    private isSessionCreated = false;

    private clientId?: string;
    private transportId?: string;
    private transportConnection?: Channel;
    private app: any;

    constructor(
            public host: string
          , public port: number
          , private appId: string
          , private sessionId: string
          , private referenceId: string) {

        const client = new Client();
        
        client.on("error", err => {
            console.error(`castv2 error: ${err}`);
        });
        client.on("close", () => {
            // TODO: Don't send new data
        });

        client.connect({ host, port }, this.onConnect.bind(this));
        this.client = client;
    }

    private onConnect() {
        let transportHeartbeat: Channel;

        const sourceId = "sender-0";
        const destinationId = "receiver-0";

        this.clientConnection = this.client.createChannel(
                sourceId, destinationId, NS_CONNECTION, "JSON");
        this.clientHeartbeat = this.client.createChannel(
                sourceId, destinationId, NS_HEARTBEAT, "JSON");
        this.clientReceiver = this.client.createChannel(
                sourceId, destinationId, NS_RECEIVER, "JSON");

        this.clientConnection.send({ type: "CONNECT" });
        this.clientHeartbeat.send({ type: "PING" });

        this.clientHeartbeatIntervalId = setInterval(() => {
            if (transportHeartbeat) {
                transportHeartbeat.send({ type: "PING" });
            }

            this.clientHeartbeat?.send({ type: "PING" });
        }, 5000);

        this.clientReceiver.send({
            type: "LAUNCH"
          , appId: this.appId
          , requestId: 1
        });

        this.clientReceiver.on("message", (message: any) => {
            if (message.type === "RECEIVER_STATUS") {
                this.sendMessage("shim:session/updateStatus", message.status);

                if (message.status.applications) {
                    const receiverApp = message.status.applications[0];
                    const receiverAppId = receiverApp.appId;
        
                    this.app = receiverApp;
        
                    if (receiverAppId !== this.appId) {
                        // Close session
                        this.sendMessage("shim:session/stopped");
                        this.client.close();
                        clearInterval(this.clientHeartbeatIntervalId!);
                        return;
                    }
        
                    if (!this.isSessionCreated) {
                        this.isSessionCreated = true;
        
                        this.transportId = this.app.transportId;
                        this.clientId =
                            `client-${Math.floor(Math.random() * 10e5)}`;
        
                        this.transportConnection = this.client.createChannel(
                                this.clientId, this.transportId!
                              , NS_CONNECTION, "JSON");
                        transportHeartbeat = this.client.createChannel(
                                this.clientId, this.transportId!
                              , NS_HEARTBEAT, "JSON");
        
                        this.transportConnection.send({ type: "CONNECT" });
        
                        this.sessionId = this.app.sessionId;
        
                        this.sendMessage("shim:session/connected", {
                            sessionId: this.app.sessionId
                          , namespaces: this.app.namespaces
                          , displayName: this.app.displayName
                          , statusText: this.app.displayName
                        });
                    }
                }
            }
        });
    }

    public messageHandler(message: Message) {
        switch (message.subject) {
            case "bridge:session/close":
                this.close();
                break;

            case "bridge:session/impl_addMessageListener":
                this._impl_addMessageListener(message.data.namespace);
                break;

            case "bridge:session/impl_sendMessage":
                this._impl_sendMessage(
                        message.data.namespace
                      , message.data.message
                      , message.data.messageId);
                break;

            case "bridge:session/impl_setReceiverMuted":
                this._impl_setReceiverMuted(
                        message.data.muted
                      , message.data.volumeId);
                break;

            case "bridge:session/impl_setReceiverVolumeLevel":
                this._impl_setReceiverVolumeLevel(
                        message.data.newLevel
                      , message.data.volumeId);
                break;

            case "bridge:session/impl_stop":
                this._impl_stop(message.data.stopId);
                break;
        }
    }

    public createChannel(namespace: string) {
        if (!this.channelMap.has(namespace)) {
            this.channelMap.set(namespace, this.client.createChannel(
                    this.clientId!, this.transportId!
                  , namespace, "JSON"));
        }
    }

    public close() {
        this.clientConnection?.send({ type: "CLOSE" });
        this.transportConnection?.send({ type: "CLOSE" });
    }

    public stop() {
        this.clientConnection?.send({ type: "STOP" });
    }

    private sendMessage(subject: string, data: any = {}) {
        data._id = this.referenceId;
        sendMessage({
            // @ts-ignore
            subject
          , data
        });
    }

    private _impl_addMessageListener(namespace: string) {
        this.createChannel(namespace);
        this.channelMap.get(namespace)?.on("message", (data: any) => {
            this.sendMessage("shim:session/impl_addMessageListener", {
                namespace
              , data: JSON.stringify(data)
            });
        });
    }

    private _impl_sendMessage(
            namespace: string
          , message: {} | string
          , messageId: string) {

        let error = false;

        try {
            // Decode string messages
            if (typeof message === "string") {
                message = JSON.parse(message);
            }

            this.createChannel(namespace);
            this.channelMap.get(namespace)!.send(message);
        } catch (err) {
            error = true;
        }

        this.sendMessage("shim:session/impl_sendMessage", {
            messageId
          , error
        });
    }

    private _impl_setReceiverMuted(muted: boolean, volumeId: string) {

        let error = false;

        try {
            this.clientReceiver!.send({
                type: "SET_VOLUME"
              , volume: { muted }
              , requestId: 0
            });
        } catch (err) {
            error = true;
        }

        this.sendMessage("shim:session/impl_setReceiverMuted", {
            volumeId
          , error
        });
    }

    private _impl_setReceiverVolumeLevel(newLevel: number, volumeId: string) {

        let error = false;

        try {
            this.clientReceiver!.send({
                type: "SET_VOLUME"
              , volume: { level: newLevel }
              , requestId: 0
            });
        } catch (err) {
            error = true;
        }

        this.sendMessage("shim:session/impl_setReceiverVolumeLevel", {
            volumeId
          , error
        });
    }

    private _impl_stop(stopId: string) {
        let error = false;

        try {
            this.clientReceiver!.send({
                type: "STOP"
              , sessionId: this.sessionId
              , requestId: 0
            });
        } catch (err) {
            error = true;
        }

        this.client.close();

        clearInterval(this.clientHeartbeatIntervalId!);

        this.sendMessage("shim:session/impl_stop", {
            stopId
          , error
        });
    }
}
