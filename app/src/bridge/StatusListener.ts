"use strict";

import { Channel, Client } from "castv2";
import { EventEmitter } from "events";

import { NS_CONNECTION
       , NS_HEARTBEAT
       , NS_RECEIVER } from "./Session";


/**
 * Creates a connection to a receiver device and forwards
 * RECEIVER_STATUS updates to the extension.
 */
export default class StatusListener extends EventEmitter {
    private client: Client;
    private clientReceiver?: Channel;
    private clientHeartbeatIntervalId?: NodeJS.Timeout;

    constructor (host: string, port: number) {
        super();

        this.client = new Client();
        this.client.connect({ host, port }, this.onConnect.bind(this));

        this.client.on("close", () => {
            clearInterval(this.clientHeartbeatIntervalId!);
        });
    }

    /**
     * Closes status listener connection.
     */
    public deregister (): void {
        if (this.clientReceiver) {
            this.clientReceiver.send({ type: "CLOSE" });
        }

        this.client.close();
    }


    private onConnect (): void {
        const sourceId = "sender-0";
        const destinationId = "receiver-0";

        const clientConnection = this.client.createChannel(
                sourceId, destinationId, NS_CONNECTION, "JSON");
        const clientHeartbeat = this.client.createChannel(
                sourceId, destinationId, NS_HEARTBEAT, "JSON");
        const clientReceiver = this.client.createChannel(
                sourceId, destinationId, NS_RECEIVER, "JSON");

        clientReceiver.on("message", data => {
            switch (data.type) {
                case "CLOSE": {
                    this.client.close();
                    break;
                }

                case "RECEIVER_STATUS": {
                    this.emit("receiverStatus", data.status);
                    break;
                }
                case "MEDIA_STATUS": {
                    this.emit("mediaStatus", data.status);
                    break;
                }
            }
        });

        clientConnection.send({ type: "CONNECT" });
        clientHeartbeat.send({ type: "PING" });
        clientReceiver.send({ type: "GET_STATUS", requestId: 1 });

        this.clientReceiver = clientReceiver;

        this.clientHeartbeatIntervalId = setInterval(() => {
            clientHeartbeat.send({ type: "PING" });
        }, 5000);
    }
}
