"use strict";

import { sendMessage } from "../../lib/nativeMessaging";
import { Message } from "../../messaging";

import Session from "./Session";


const sessions = new Map<string, Session>();

export function handleCastMessage(message: Message) {
    switch (message.subject) {
        case "bridge:createCastSession": {
            const { appId, receiverDevice } = message.data;

            // Connect and store with returned ID
            const session = new Session(appId, receiverDevice);
            session.connect(
                    receiverDevice.host, receiverDevice.port, sessionId => {
                sessions.set(sessionId, session);
            });

            break;
        }

        case "bridge:sendCastReceiverMessage": {
            const { sessionId, messageData, messageId } = message.data;

            const session = sessions.get(sessionId);
            if (!session) {
                sendMessage({
                    subject: "shim:impl_sendCastMessage"
                  , data: {
                        error: "Session does not exist"
                      , sessionId, messageId
                    }
                });

                break;
            }

            try {
                session.sendReceiverMessage(messageData);
            } catch (err) {
                sendMessage({
                    subject: "shim:impl_sendCastMessage"
                  , data: {
                        error: `Failed to send message (${err})`
                      , sessionId, messageId
                    }
                });

                break;
            }

            // Success
            sendMessage({
                subject: "shim:impl_sendCastMessage"
              , data: { sessionId, messageId }
            });

            break;
        }

        case "bridge:sendCastSessionMessage": {
            const { namespace, sessionId, messageId } = message.data;

            const session = sessions.get(sessionId);
            if (!session) {
                sendMessage({
                    subject: "shim:impl_sendCastMessage"
                  , data: {
                        error: "Session does not exist"
                      , sessionId, messageId
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
                sendMessage({
                    subject: "shim:impl_sendCastMessage"
                  , data: {
                        error: `Failed to send message (${err})`
                      , sessionId, messageId
                    }
                });

                break;
            }

            // Success
            sendMessage({
                subject: "shim:impl_sendCastMessage"
              , data: { sessionId, messageId }
            });

            break;
        }

        case "bridge:stopCastApp": {
            break;
        }
    }
}
