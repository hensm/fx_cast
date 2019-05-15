"use strict";

import uuid from "uuid";

import { Channel, Client } from "castv2";

import { Message
       , SendMessageCallback } from "./types";


const NS_CONNECTION = "urn:x-cast:com.google.cast.tp.connection";
const NS_HEARTBEAT = "urn:x-cast:com.google.cast.tp.heartbeat";
const NS_RECEIVER = "urn:x-cast:com.google.cast.receiver";

export default class Session {
    public channelMap = new Map<string, Channel>();

    private sendMessageCallback: SendMessageCallback;
    private sessionId: number;
    private referenceId: string;

    private client: Client;
    private clientConnection: Channel;
    private clientHeartbeat: Channel;
    private clientReceiver: Channel;
    private clientHeartbeatIntervalId: NodeJS.Timer;

    private isSessionCreated = false;

    private clientId: string;
    private transportId: string;
    private transportConnection: Channel;
    private app: any;

    constructor (
            host: string
          , port: number
          , appId: string
          , sessionId: number
          , referenceId: string
          , sendMessageCallback: SendMessageCallback) {

        this.sessionId = sessionId;
        this.referenceId = referenceId;
        this.sendMessageCallback = sendMessageCallback;

        this.client = new Client();

        this.client.connect({ host, port }, () => {
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

                this.clientHeartbeat.send({ type: "PING" });
            }, 5000);

            this.clientReceiver.send({
                type: "LAUNCH"
              , appId
              , requestId: 1
            });

            this.clientReceiver.on("message", (message: any) => {
                if (message.type === "RECEIVER_STATUS") {
                    this.sendMessage("shim:/session/updateStatus"
                          , message.status);

                    if (!message.status.applications) {
                        return;
                    }

                    const receiverApp = message.status.applications[0];
                    const receiverAppId = receiverApp.appId;

                    this.app = receiverApp;

                    if (receiverAppId !== appId) {
                        // Close session
                        this.sendMessage("shim:/session/stopped");
                        this.client.close();
                        clearInterval(this.clientHeartbeatIntervalId);
                        return;
                    }

                    if (!this.isSessionCreated) {
                        this.isSessionCreated = true;

                        this.transportId = this.app.transportId;
                        this.clientId =
                            `client-${Math.floor(Math.random() * 10e5)}`;

                        this.transportConnection = this.client.createChannel(
                                this.clientId, this.transportId
                              , NS_CONNECTION, "JSON");
                        transportHeartbeat = this.client.createChannel(
                                this.clientId, this.transportId
                              , NS_HEARTBEAT, "JSON");

                        this.transportConnection.send({ type: "CONNECT" });

                        this.sessionId = this.app.sessionId;

                        this.sendMessage("shim:/session/connected", {
                            sessionId: this.app.sessionId
                          , namespaces: this.app.namespaces
                          , displayName: this.app.displayName
                          , statusText: this.app.displayName
                        });
                    }
                }
            });
        });
    }

    public messageHandler (message: Message) {
        switch (message.subject) {
            case "bridge:/session/close":
                this.close();
                break;

            case "bridge:/session/impl_addMessageListener":
                this._impl_addMessageListener(message.data.namespace);
                break;

            case "bridge:/session/impl_sendMessage":
                this._impl_sendMessage(
                        message.data.namespace
                      , message.data.message
                      , message.data.messageId);
                break;

            case "bridge:/session/impl_setReceiverMuted":
                this._impl_setReceiverMuted(
                        message.data.muted
                      , message.data.volumeId);
                break;

            case "bridge:/session/impl_setReceiverVolumeLevel":
                this._impl_setReceiverVolumeLevel(
                        message.data.newLevel
                      , message.data.volumeId);
                break;

            case "bridge:/session/impl_stop":
                this._impl_stop(message.data.stopId);
                break;
        }
    }

    public createChannel (namespace: string) {
        if (!this.channelMap.has(namespace)) {
            this.channelMap.set(namespace
                , this.client.createChannel(
                        this.clientId, this.transportId, namespace, "JSON"));
        }
    }

    public close () {
        this.clientConnection.send({ type: "CLOSE" });
        if (this.transportConnection) {
            this.transportConnection.send({ type: "CLOSE" });
        }
    }

    private sendMessage (subject: string, data: any = {}) {
        this.sendMessageCallback({
            subject
          , data
          , _id: this.referenceId
        });
    }

    private _impl_addMessageListener (namespace: string) {
        this.createChannel(namespace);
        this.channelMap.get(namespace).on("message", (data: any) => {
            this.sendMessage("shim:/session/impl_addMessageListener", {
                namespace
              , data: JSON.stringify(data)
            });
        });
    }

    private _impl_sendMessage (
            namespace: string
          , message: object
          , messageId: string) {

        let error = false;

        try {
            this.createChannel(namespace);
            this.channelMap.get(namespace).send(message);
        } catch (err) {
            error = true;
        }

        this.sendMessage("shim:/session/impl_sendMessage", {
            messageId
          , error
        });
    }

    private _impl_setReceiverMuted (muted: boolean, volumeId: string) {

        let error = false;

        try {
            this.clientReceiver.send({
                type: "SET_VOLUME"
              , volume: { muted }
              , requestId: 0
            });
        } catch (err) {
            error = true;
        }

        this.sendMessage("shim:/session/impl_setReceiverMuted", {
            volumeId
          , error
        });
    }

    private _impl_setReceiverVolumeLevel (newLevel: number, volumeId: string) {

        let error = false;

        try {
            this.clientReceiver.send({
                type: "SET_VOLUME"
              , volume: { level: newLevel }
              , requestId: 0
            });
        } catch (err) {
            error = true;
        }

        this.sendMessage("shim:/session/impl_setReceiverVolumeLevel", {
            volumeId
          , error
        });
    }

    private _impl_stop (stopId: string) {
        let error = false;

        try {
            this.clientReceiver.send({
                type: "STOP"
              , sessionId: this.sessionId
              , requestId: 0
            });
        } catch (err) {
            error = true;
        }

        this.client.close();

        clearInterval(this.clientHeartbeatIntervalId);

        this.sendMessage("shim:/session/impl_stop", {
            stopId
          , error
        });
    }
}
