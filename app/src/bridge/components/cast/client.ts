"use strict";

import { Channel, Client } from "castv2";

export const NS_CONNECTION = "urn:x-cast:com.google.cast.tp.connection";
export const NS_HEARTBEAT = "urn:x-cast:com.google.cast.tp.heartbeat";
export const NS_RECEIVER = "urn:x-cast:com.google.cast.receiver";

const DEFAULT_PORT = 8009;
const HEARTBEAT_INTERVAL_MS = 5000;

interface CastClientConnectOptions {
    port?: number;
    onHeartbeat?: () => void;
}

export default class CastClient {
    protected client = new Client();

    protected connectionChannel?: Channel;
    protected heartbeatChannel?: Channel;
    protected heartbeatIntervalId?: NodeJS.Timeout;

    constructor(
        protected sourceId = "sender-0",
        protected destinationId = "receiver-0"
    ) {}

    /**
     * Create a channel on the client connection with a given
     * namespace.
     */
    protected createChannel(
        namespace: string,
        sourceId = this.sourceId,
        destinationId = this.destinationId
    ) {
        return this.client.createChannel(
            sourceId,
            destinationId,
            namespace,
            "JSON"
        );
    }

    /**
     * Connects to a cast receiver at a given host, returning a
     * promise that resolves once the client is connected.
     */
    connect(host: string, options?: CastClientConnectOptions) {
        return new Promise<void>((resolve, reject) => {
            // Handle errors
            this.client.on("error", reject);
            this.client.on("close", () => {
                if (this.heartbeatChannel && this.heartbeatIntervalId) {
                    clearInterval(this.heartbeatIntervalId);
                }
            });

            const connectOpts = {
                host,
                port: options?.port ?? DEFAULT_PORT
            };

            this.client.connect(connectOpts, () => {
                this.connectionChannel = this.createChannel(NS_CONNECTION);
                this.heartbeatChannel = this.createChannel(NS_HEARTBEAT);

                this.connectionChannel.send({ type: "CONNECT" });
                this.heartbeatChannel.send({ type: "PING" });

                this.heartbeatIntervalId = setInterval(() => {
                    this.heartbeatChannel?.send({ type: "PING" });
                    options?.onHeartbeat?.();
                }, HEARTBEAT_INTERVAL_MS);

                resolve();
            });
        });
    }

    disconnect() {
        if (this.heartbeatIntervalId) {
            clearInterval(this.heartbeatIntervalId);
        }

        this.connectionChannel?.send({ type: "CLOSE" });
        this.client.close();
    }
}
