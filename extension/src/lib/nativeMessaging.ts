import logger from "./logger";
import options from "./options";

import type { Message, Port } from "../messaging";

type DisconnectListener = (port: Port) => void;
type MessageListener = (message: Message) => void;

/**
 * Create backup server URL from configured options.
 */
async function getBackupServerUrl() {
    const {
        bridgeBackupHost,
        bridgeBackupPort,
        bridgeBackupSecure,
        bridgeBackupPassword
    } = await options.getAll();

    const url = new URL(
        `${bridgeBackupSecure ? "wss" : "ws"}://${
            // Handle IPv6 address formatting
            bridgeBackupHost.includes(":")
                ? `[${bridgeBackupHost}]`
                : bridgeBackupHost
        }`
    );
    url.port = bridgeBackupPort.toString();

    if (bridgeBackupPassword) {
        url.searchParams.append("password", bridgeBackupPassword);
    }

    return url;
}

/**
 * `browser.runtime.connectNative()` wrapper.
 */
export function connectNative(application: string): Port {
    /** Whether native host or backup is ready for messages. */
    let isNativeHostReady = false;

    let backupSocket: Nullable<WebSocket> = null;
    let backupMessageQueue: Message[] = [];

    // Make initial connection to native host
    const port = browser.runtime.connectNative(application); //

    const messageListeners = new Set<MessageListener>();
    const disconnectListeners = new Set<DisconnectListener>();

    const portObject: Port = {
        name: "",

        onDisconnect: {
            addListener(cb: DisconnectListener) {
                disconnectListeners.add(cb);
            },
            removeListener(cb: DisconnectListener) {
                disconnectListeners.delete(cb);
            },
            hasListener(cb: DisconnectListener) {
                return disconnectListeners.has(cb);
            },
            hasListeners() {
                return disconnectListeners.size > 0;
            }
        },
        onMessage: {
            addListener(cb: MessageListener) {
                messageListeners.add(cb);
            },
            removeListener(cb: MessageListener) {
                messageListeners.delete(cb);
            },
            hasListener(cb: MessageListener) {
                return messageListeners.has(cb);
            },
            hasListeners() {
                return messageListeners.size > 0;
            }
        },

        disconnect() {
            if (backupSocket) {
                backupSocket.close();
            } else {
                port.disconnect();
            }
        },

        postMessage(message) {
            if (!isNativeHostReady) {
                // Queue messages until ready
                backupMessageQueue.push(message);
            } else if (backupSocket) {
                backupSocket.send(JSON.stringify(message));
                return;
            }

            port.postMessage(message);
        }
    };

    port.onDisconnect.addListener(async () => {
        const bridgeBackupEnabled = await options.get("bridgeBackupEnabled");
        if (!bridgeBackupEnabled) {
            portObject.error = { message: "" };
            for (const listener of disconnectListeners) {
                listener(portObject);
            }

            throw logger.error(
                "Bridge connection failed and backup not enabled."
            );
        }

        /**
         * If port disconnected because of an error and native host
         * status had not already been resolved.
         */
        if (port.error && !isNativeHostReady) {
            backupSocket = new WebSocket(await getBackupServerUrl());

            backupSocket.addEventListener("open", () => {
                isNativeHostReady = true;

                // Send all messages in queue
                while (backupMessageQueue.length) {
                    backupSocket?.send(
                        JSON.stringify(backupMessageQueue.shift())
                    );
                }
            });
            backupSocket.addEventListener("message", ev => {
                for (const listener of messageListeners) {
                    listener(JSON.parse(ev.data));
                }
            });
            backupSocket.addEventListener("close", ev => {
                // If not a normal closure, set error message
                if (ev.code !== 1000) {
                    portObject.error = { message: ev.reason };
                }

                for (const listener of disconnectListeners) {
                    listener(portObject);
                }
            });
        }
    });

    port.onMessage.addListener((message: Message) => {
        if (!isNativeHostReady) {
            isNativeHostReady = true;
            backupMessageQueue = [];
        }

        for (const listener of messageListeners) {
            listener(message);
        }
    });

    return portObject;
}

/**
 * `browser.runtime.sendNativeMessage()` wrapper.
 */
export async function sendNativeMessage(application: string, message: Message) {
    try {
        return await browser.runtime.sendNativeMessage(application, message);
    } catch {
        const { bridgeBackupEnabled, bridgeBackupSecure } =
            await options.getAll();

        if (!bridgeBackupEnabled) {
            throw logger.error(
                "Bridge connection failed and backup not enabled."
            );
        }

        const backupServerUrl = await getBackupServerUrl();

        const backupServerHttpUrl = new URL(backupServerUrl);
        backupServerHttpUrl.protocol = bridgeBackupSecure ? "https" : "http";

        // Send HTTP request to check authentication
        if ((await fetch(backupServerHttpUrl)).status === 401) {
            logger.error(
                "Bridge daemon connection failed due to authentication error."
            );

            throw 401;
        }

        return await new Promise((resolve, reject) => {
            const backupSocket = new WebSocket(backupServerUrl);

            backupSocket.addEventListener("open", () => {
                backupSocket.send(JSON.stringify(message));
            });
            backupSocket.addEventListener("message", ev => {
                backupSocket.close();
                resolve(JSON.parse(ev.data));
            });
            backupSocket.addEventListener("error", () => {
                logger.error("Bridge daemon connection error.");
                reject();
            });
        });
    }
}
