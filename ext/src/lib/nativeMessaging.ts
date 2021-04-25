"use strict";

import logger from "./logger";
import options from "./options";

import { Message, Port } from "../messaging";



type DisconnectListener = (port: Port) => void;
type MessageListener = (message: Message) => void;

function connectNative (application: string): Port {
    /**
     * In order to preserve the synchronous API, messages are
     * queued before either the native messaging host or the
     * WebSocket connection is ready to send data.
     */
    let messageQueue: object[] = [];

    /**
     * Set once the native messaging host is known to be either
     * present/missing. Determines whether messages go to the
     * message queue.
     */
    let isNativeHostStatusKnown = false;

    const port = browser.runtime.connectNative(application);


    let socket: WebSocket;

    const onDisconnectListeners = new Set<DisconnectListener>();
    const onMessageListeners = new Set<MessageListener>();

    // Port proxy API
    const portObject: Port = {
        error: null as any
      , name: ""

      , onDisconnect: {
            addListener (cb: DisconnectListener) {
                onDisconnectListeners.add(cb);
            }
          , removeListener (cb: DisconnectListener) {
                onDisconnectListeners.delete(cb);
            }
          , hasListener (cb: DisconnectListener) {
                return onDisconnectListeners.has(cb);
            }
          , hasListeners () {
                return onDisconnectListeners.size > 0;  
            }
        }
      , onMessage: {
            addListener (cb: MessageListener) {
                onMessageListeners.add(cb);
            }
          , removeListener (cb: MessageListener) {
                onMessageListeners.delete(cb);
            }
          , hasListener (cb: MessageListener) {
                return onMessageListeners.has(cb);
            }
          , hasListeners () {
                return onMessageListeners.size > 0;  
            }
        }

      , disconnect () {
            if (socket) {
                socket.close();
            } else {
                port.disconnect();
            }
        }

      , postMessage (message) {
            if (socket) {
                switch (socket.readyState) {
                    case WebSocket.CONNECTING: {
                        // Queue message  until WebSocket is ready
                        messageQueue.push(message);
                        break;
                    }

                    case WebSocket.OPEN: {
                        socket.send(JSON.stringify(message));
                        break;
                    }
                }
            } else {
                if (!isNativeHostStatusKnown) {
                    // Queue message until native messaging host is ready
                    messageQueue.push(message);
                }

                port.postMessage(message);
            }
        }
    };


    port.onDisconnect.addListener(async () => {
        const { bridgeBackupEnabled
              , bridgeBackupHost
              , bridgeBackupPort } = await options.getAll();

        if (!bridgeBackupEnabled) {
            portObject.error = {
                message: ""
            };

            for (const listener of onDisconnectListeners) {
                listener(portObject);
            }

            throw logger.error("Bridge connection failed and backup not enabled.");
        }

        if (port.error && !isNativeHostStatusKnown) {
            isNativeHostStatusKnown = true;

            socket = new WebSocket(
                    `ws://${bridgeBackupHost}:${bridgeBackupPort}`);

            socket.addEventListener("open", () => {
                // Send all messages in queue
                while (messageQueue.length) {
                    const message = messageQueue.pop();
                    socket.send(JSON.stringify(message));
                }
            });

            socket.addEventListener("message", ev => {
                for (const listener of onMessageListeners) {
                    listener(JSON.parse(ev.data));
                }
            });

            socket.addEventListener("close", ev => {
                if (ev.code !== 1000) {
                    portObject.error = {
                        // TODO: Set a proper error message
                        message: ""
                    };
                }

                for (const listener of onDisconnectListeners) {
                    listener(portObject);
                }
            });
        }
    });

    port.onMessage.addListener((message: any) => {
        if (!isNativeHostStatusKnown) {
            isNativeHostStatusKnown = true;
            messageQueue = [];
        }

        for (const listener of onMessageListeners) {
            listener(message);
        }
    });


    return portObject;
}

async function sendNativeMessage (
        application: string
      , message: Message) {

    try {
        return await browser.runtime.sendNativeMessage(application, message);
    } catch {
        const { bridgeBackupEnabled
              , bridgeBackupHost
              , bridgeBackupPort } = await options.getAll();

        if (!bridgeBackupEnabled) {
            throw logger.error("Bridge connection failed and backup not enabled.");
        }

        const port = await options.get("bridgeBackupPort");

        return await new Promise((resolve, reject) => {
            const ws = new WebSocket(
                    `ws://${bridgeBackupHost}:${bridgeBackupPort}`);

            ws.addEventListener("open", () => {
                ws.send(JSON.stringify(message));
            });

            ws.addEventListener("message", ev => {
                ws.close();
                resolve(JSON.parse(ev.data));
            });

            ws.addEventListener("error", () => {
                logger.error("No bridge application found.");
                reject();
            });
        });
    }
}


export default {
    connectNative
  , sendNativeMessage
};
