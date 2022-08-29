"use strict";

import type { Channel } from "castv2";

import messaging from "../../messaging";

import type { ReceiverDevice } from "../../messagingTypes";
import type { ReceiverMessage } from "./types";

import CastClient, { NS_CONNECTION, NS_HEARTBEAT } from "./client";

type OnSessionCreatedCallback = (sessionId: string) => void;

export default class Session extends CastClient {
    // Assigned by the receiver once the session is established
    public sessionId?: string;

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

    private establishAppConnection(transportId: string) {
        this.transportConnection = this.createChannel(
            NS_CONNECTION,
            this.sourceId,
            transportId
        );
        this.transportHeartbeat = this.createChannel(
            NS_HEARTBEAT,
            this.sourceId,
            transportId
        );

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
                    app => app.appId === this.appId
                );

                /**
                 * If application isn't set, still waiting on the launch
                 * request response.
                 */
                if (!this.sessionId) {
                    // Match request ID on the response to the launch request ID.
                    if (message.requestId !== this.launchRequestId) {
                        break;
                    }

                    if (application) {
                        this.sessionId = application.sessionId;
                        this.transportId = application.transportId;

                        this.establishAppConnection(this.transportId);
                        this.onSessionCreated?.(this.sessionId);

                        messaging.sendMessage({
                            subject: "main:castSessionCreated",
                            data: {
                                sessionId: this.sessionId,
                                statusText: application.statusText,
                                namespaces: application.namespaces,
                                volume: status.volume,
                                appId: application.appId,
                                displayName: application.displayName,
                                receiverId: this.receiverDevice.id,
                                receiverFriendlyName:
                                    this.receiverDevice.friendlyName,
                                transportId: this.sessionId,

                                // TODO: Fix this
                                senderApps: [],
                                appImages: []
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

                messaging.sendMessage({
                    subject: "main:castSessionUpdated",
                    data: {
                        sessionId: this.sessionId,
                        statusText: application.statusText,
                        namespaces: application.namespaces,
                        volume: message.status.volume
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
    };

    sendMessage(namespace: string, message: unknown) {
        let channel = this.namespaceChannelMap.get(namespace);
        if (!channel) {
            channel = this.createChannel(
                namespace,
                this.sourceId,
                this.transportId
            );

            channel.on("message", messageData => {
                if (!this.sessionId) {
                    return;
                }

                messageData = JSON.stringify(messageData);

                messaging.sendMessage({
                    subject: "cast:receivedSessionMessage",
                    data: {
                        sessionId: this.sessionId,
                        namespace,
                        messageData
                    }
                });
            });

            this.namespaceChannelMap.set(namespace, channel);
        }

        channel.send(message);
    }

    constructor(
        private appId: string,
        private receiverDevice: ReceiverDevice,
        private onSessionCreated?: OnSessionCreatedCallback
    ) {
        super();

        super
            .connect(receiverDevice.host, {
                onHeartbeat: () => {
                    // Include transport heartbeat with platform heartbeat
                    if (this.transportHeartbeat) {
                        this.transportHeartbeat.send({ type: "PING" });
                    }
                },
                onReceiverMessage: message => {
                    this.onReceiverMessage(message);
                }
            })
            .then(() => {
                // Send a launch request and store the request ID for reference
                this.launchRequestId = this.sendReceiverMessage({
                    type: "LAUNCH",
                    appId: this.appId
                });
            });

        // Handle client connection closed
        this.client.on("close", () => {
            if (this.sessionId) {
                messaging.sendMessage({
                    subject: "cast:sessionStopped",
                    data: { sessionId: this.sessionId }
                });
            }
        });
    }
}
