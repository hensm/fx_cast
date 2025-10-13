import type { Messenger, Message } from "./messaging";

import { handleCastMessage } from "./components/cast";
import Discovery from "./components/cast/discovery";
import Remote from "./components/cast/remote";

import { startMediaServer, stopMediaServer } from "./components/mediaServer";

import { applicationVersion } from "../../config.json";

process.on("SIGTERM", async () => {
    discovery?.stop();
    try {
        await stopMediaServer();
    } catch (err) {
        console.error("Error stopping media server!", err);
    } finally {
        process.exit(1);
    }
});

let discovery: Discovery | null = null;
const remotes = new Map<string, Remote>();

/**
 * Handle incoming messages from the extension and forward
 * them to the appropriate handlers.
 *
 * Initializes the counterpart objects and is responsible
 * for managing existing ones.
 */
export function run(messaging: Messenger) {
    messaging.on("message", (message: Message) => {
        switch (message.subject) {
            case "bridge:getInfo":
            case "bridge:/getInfo": {
                messaging.send(applicationVersion);
                break;
            }

            case "bridge:startDiscovery": {
                const { shouldWatchStatus } = message.data;

                discovery = new Discovery({
                    onDeviceFound(device) {
                        messaging.sendMessage({
                            subject: "main:deviceUp",
                            data: {
                                deviceId: device.id,
                                deviceInfo: device
                            }
                        });

                        if (shouldWatchStatus) {
                            remotes.set(
                                device.id,
                                new Remote(device.host, {
                                    port: device.port,
                                    // RECEIVER_STATUS
                                    onReceiverStatusUpdate(status) {
                                        messaging.sendMessage({
                                            subject:
                                                "main:receiverDeviceStatusUpdated",
                                            data: {
                                                deviceId: device.id,
                                                status
                                            }
                                        });
                                    },
                                    // MEDIA_STATUS
                                    onMediaStatusUpdate(status) {
                                        if (!status) return;

                                        messaging.sendMessage({
                                            subject:
                                                "main:receiverDeviceMediaStatusUpdated",
                                            data: {
                                                deviceId: device.id,
                                                status
                                            }
                                        });
                                    }
                                })
                            );
                        }
                    },
                    onDeviceDown(deviceId) {
                        messaging.sendMessage({
                            subject: "main:deviceDown",
                            data: { deviceId }
                        });

                        if (shouldWatchStatus) {
                            if (remotes.has(deviceId)) {
                                remotes.get(deviceId)?.disconnect();
                                remotes.delete(deviceId);
                            }
                        }
                    }
                });

                discovery.start();

                break;
            }

            case "bridge:sendReceiverMessage": {
                const { deviceId, message: receiverMessage } = message.data;
                remotes.get(deviceId)?.sendReceiverMessage(receiverMessage);
                break;
            }
            case "bridge:sendMediaMessage": {
                const { deviceId, message: mediaMessage } = message.data;
                remotes.get(deviceId)?.sendMediaMessage(mediaMessage);
                break;
            }

            // Media server
            case "bridge:startMediaServer": {
                const { filePath, port } = message.data;
                startMediaServer(messaging, filePath, port);
                break;
            }
            case "bridge:stopMediaServer": {
                stopMediaServer();
                break;
            }

            default: {
                handleCastMessage(messaging, message);
            }
        }
    });
}
