"use strict";

import { Channel, Client } from "castv2";

import { sendMessage } from "../../lib/nativeMessaging";

import { ReceiverDevice } from "../../types";
import { ReceiverApplication, ReceiverMessage, SenderMessage } from "./types";


export const NS_CONNECTION = "urn:x-cast:com.google.cast.tp.connection";
export const NS_HEARTBEAT = "urn:x-cast:com.google.cast.tp.heartbeat";
export const NS_RECEIVER = "urn:x-cast:com.google.cast.receiver";

const HEARTBEAT_INTERVAL = 5000;


class CastClient {
    protected client = new Client();

    protected connectionChannel?: Channel;
    protected heartbeatChannel?: Channel;
    protected heartbeatIntervalId?: NodeJS.Timeout;

    constructor(protected sourceId = "sender-0"
              , protected destinationId = "receiver-0") {}

    /**
     * Create a channel on the client connection with a given
     * namespace.
     */
    createChannel(namespace: string
                , sourceId = this.sourceId
                , destinationId = this.destinationId) {

       return this.client.createChannel(sourceId, destinationId, namespace, "JSON");
    }

    connect(host: string, port: number, onHeartbeat?: () => void) {
        return new Promise<void>((resolve, reject) => {
            // Handle errors
            this.client.on("error", reject);
            this.client.on("close", () => {
                if (this.heartbeatChannel && this.heartbeatIntervalId) {
                    clearInterval(this.heartbeatIntervalId);
                }
            });

            this.client.connect({ host, port }, () => {
                this.connectionChannel = this.createChannel(NS_CONNECTION);
                this.heartbeatChannel = this.createChannel(NS_HEARTBEAT);
                
                this.connectionChannel.send({ type: "CONNECT" });
                this.heartbeatChannel.send({ type: "PING" });
                
                this.heartbeatIntervalId = setInterval(() => {
                    this.heartbeatChannel?.send({ type: "PING" });
                    if (onHeartbeat) {
                        onHeartbeat();
                    }
                }, HEARTBEAT_INTERVAL);

                resolve();
            });
        });
    }
}


type OnSessionCreatedCallback = (sessionId: string) => void;

export default class Session extends CastClient {
    // Assigned by the receiver once the session is established
    public sessionId?: string;

    // Platform messaging
    private receiverChannel?: Channel;
    private receiverRequestId = 0;

    // Receiver app messaging
    private transportId?: string;
    private transportConnection?: Channel;
    private transportHeartbeat?: Channel;
    
    // Channels created by `sendCastSessionMessage` messages
    private namespaceChannelMap = new Map<string, Channel>();

    /**
     * Request ID used to correlate the launch request with the
     * RECEIVER_STATUS message associated with session creation.
     */
    private launchRequestId?: number;

    private onSessionCreated?: OnSessionCreatedCallback;


    private establishAppConnection(transportId: string) {
        this.transportConnection = this.createChannel(
                NS_CONNECTION, this.sourceId, transportId);
        this.transportHeartbeat = this.createChannel(
                NS_HEARTBEAT, this.sourceId, transportId);

        this.transportConnection.send({ type: "CONNECT" });
    }

    /**
     * Handle incoming receiver messages.
     */
    private onReceiverMessage = (message: ReceiverMessage) => {
        switch (message.type) {
            case "RECEIVER_STATUS": {
                const { status } = message;
                const application = status.applications?.find(
                        app => app.appId === this.appId);

                /**
                 * If application isn't set, still waiting on the launch
                 * request response.
                 */
                if (!this.sessionId) {
                    // Launch message response only
                    if (message.requestId !== this.launchRequestId) {
                        break;
                    }

                    if (application) {
                        this.sessionId = application.sessionId;
                        this.transportId = application.transportId;

                        this.establishAppConnection(this.transportId);
                        this.onSessionCreated?.(this.sessionId);

                        const { friendlyName } = this.receiverDevice;

                        sendMessage({
                            subject: "shim:castSessionCreated"
                          , data: {
                                sessionId: this.sessionId
                              , statusText: application.statusText
                              , namespaces: application.namespaces
                              , volume: status.volume
                              , appId: application.appId
                              , displayName: application.displayName
                              , receiverFriendlyName: friendlyName
                              , transportId: this.sessionId

                              // TODO: Fix this
                              , senderApps: []
                              , appImages: []
                            }
                        });
                    }

                    break;
                }

                // Handle session stop
                if (!application) {
                    this.client.close();
                    break;
                }

                sendMessage({
                    subject: "shim:castSessionUpdated"
                  , data: {
                        sessionId: this.sessionId
                      , statusText: application.statusText
                      , namespaces: application.namespaces
                      , volume: message.status.volume
                    }
                });
                
                break;
            }

            case "LAUNCH_ERROR": {
                console.error(`err: LAUNCH_ERROR, ${message.reason}`);
                this.client.close();
                break;
            }
        }
    }

    sendMessage(namespace: string, message: unknown) {
        let channel = this.namespaceChannelMap.get(namespace);
        if (!channel) {
            channel = this.createChannel(
                    namespace, this.sourceId, this.transportId);

            channel.on("message", messageData => {
                if (!this.sessionId) {
                    return;
                }

                messageData = JSON.stringify(messageData);

                sendMessage({
                    subject: "shim:receivedCastSessionMessage"
                  , data: {
                        sessionId: this.sessionId
                      , namespace
                      , messageData
                    }
                });
            });

            this.namespaceChannelMap.set(namespace, channel);
        }

        channel.send(message);
    }

    sendReceiverMessage(message: DistributiveOmit<SenderMessage, "requestId">) {
        if (!this.receiverChannel) {
            this.receiverChannel = this.createChannel(NS_RECEIVER);
            this.receiverChannel.on("message", this.onReceiverMessage);
        }

        const requestId = this.receiverRequestId++;
        this.receiverChannel?.send({ ...message, requestId });

        return requestId;
    }

    constructor(public appId: string
              , public receiverDevice: ReceiverDevice) {

        super();

        this.client.on("close", () => {
            if (this.sessionId) {
                sendMessage({
                    subject: "shim:castSessionStopped"
                  , data: { sessionId: this.sessionId }
                });
            }
        });
    }

    async connect(host: string
                , port: number
                , onSessionCreated?: OnSessionCreatedCallback) {

        if (onSessionCreated) {
            this.onSessionCreated = onSessionCreated;
        }

        await super.connect(host, port, () => {
            // Include transport heartbeat with platform heartbeat
            if (this.transportHeartbeat) {
                this.transportHeartbeat.send({ type: "PING" });
            }
        });

        this.launchRequestId = this.sendReceiverMessage({
            type: "LAUNCH"
          , appId: this.appId
        });
    }
}
