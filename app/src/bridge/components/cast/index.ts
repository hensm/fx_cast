"use strict";

import messaging, { Message } from "../../messaging";

import Session from "./Session";
import CastClient from "./client";

const sessions = new Map<string, Session>();

export function handleCastMessage(message: Message) {
    switch (message.subject) {
        case "bridge:createCastSession": {
            const { appId, receiverDevice } = message.data;

            // Connect and store with returned ID
            const session = new Session(appId, receiverDevice, sessionId => {
                sessions.set(sessionId, session);
            });

            break;
        }

        case "bridge:sendCastReceiverMessage": {
            const { sessionId, messageData, messageId } = message.data;

            const session = sessions.get(sessionId);
            if (!session) {
                messaging.sendMessage({
                    subject: "cast:impl_sendMessage",
                    data: {
                        error: "Session does not exist",
                        sessionId,
                        messageId
                    }
                });

                break;
            }

            try {
                session.sendReceiverMessage(messageData);
            } catch (err) {
                messaging.sendMessage({
                    subject: "cast:impl_sendMessage",
                    data: {
                        error: `Failed to send message (${err})`,
                        sessionId,
                        messageId
                    }
                });

                break;
            }

            // Success
            messaging.sendMessage({
                subject: "cast:impl_sendMessage",
                data: { sessionId, messageId }
            });

            break;
        }

        case "bridge:sendCastSessionMessage": {
            const { namespace, sessionId, messageId } = message.data;

            const session = sessions.get(sessionId);
            if (!session) {
                messaging.sendMessage({
                    subject: "cast:impl_sendMessage",
                    data: {
                        error: "Session does not exist",
                        sessionId,
                        messageId
                    }
                });

                break;
            }

            try {
                // Handle string messages
                let { messageData } = message.data;
                if (typeof messageData === "string") {
                    messageData = JSON.parse(messageData);
                }

                session.sendMessage(namespace, messageData);
            } catch (err) {
                messaging.sendMessage({
                    subject: "cast:impl_sendMessage",
                    data: {
                        error: `Failed to send message (${err})`,
                        sessionId,
                        messageId
                    }
                });

                break;
            }

            // Success
            messaging.sendMessage({
                subject: "cast:impl_sendMessage",
                data: { sessionId, messageId }
            });

            break;
        }

        case "bridge:stopCastSession": {
            const { receiverDevice } = message.data;

            const client = new CastClient();
            client.connect(receiverDevice.host).then(() => {
                (client.sendReceiverMessage as any)({ type: "STOP" });
            });

            break;
        }
    }
}
