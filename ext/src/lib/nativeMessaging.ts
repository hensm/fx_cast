"use strict";

const WEBSOCKET_DAEMON_URL = "ws://localhost:9556";


type DisconnectListener = (port: browser.runtime.Port) => void;
type MessageListener = (message: any) => void;

function connectNative (application: string) {
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
    const portObject: browser.runtime.Port = {
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

            // Workaround for modified types
          , hasListeners () { return false; }
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


    port.onDisconnect.addListener(() => {
        if (port.error && !isNativeHostStatusKnown) {
            isNativeHostStatusKnown = true;

            socket = new WebSocket(WEBSOCKET_DAEMON_URL);

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
      , message: any) {

    try {
        return await browser.runtime.sendNativeMessage(application, message);
    } catch (err) {
        return await new Promise((resolve, reject) => {
            const ws = new WebSocket(WEBSOCKET_DAEMON_URL);

            ws.addEventListener("open", () => {
                ws.send(JSON.stringify(message));
            });

            ws.addEventListener("message", ev => {
                ws.close();
                resolve(JSON.parse(ev.data));
            });

            ws.addEventListener("error", () => {
                console.error("fx_cast (Debug): No bridge application found.");
                reject();
            });
        });
    }
}


export default {
    connectNative
  , sendNativeMessage
};
