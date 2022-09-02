import bridge from "../lib/bridge";
import logger from "../lib/logger";
import { TypedEventTarget } from "../lib/TypedEventTarget";

import type { Message, Port } from "../messaging";
import type { ReceiverDevice } from "../types";

import type {
    MediaStatus,
    ReceiverStatus,
    SenderMediaMessage,
    SenderMessage
} from "../cast/sdk/types";
import { PlayerState } from "../cast/sdk/media/enums";

interface EventMap {
    deviceUp: { deviceInfo: ReceiverDevice };
    deviceDown: { deviceId: string };
    deviceUpdated: {
        deviceId: string;
        status: ReceiverStatus;
    };
    deviceMediaUpdated: {
        deviceId: string;
        status: MediaStatus;
    };
}

export default new (class extends TypedEventTarget<EventMap> {
    /**
     * Map of receiver device IDs to devices. Updated as receiverDevice
     * messages are received from the bridge.
     */
    private receiverDevices = new Map<string, ReceiverDevice>();

    private bridgePort?: Port;
    async init() {
        if (!this.bridgePort) {
            await this.refresh();
        }
    }

    /**
     * Initializes (or re-initializes) a bridge connection to start
     * dispatching events.
     */
    async refresh() {
        this.bridgePort?.disconnect();
        this.receiverDevices.clear();

        this.bridgePort = await bridge.connect();
        this.bridgePort.onMessage.addListener(this.onBridgeMessage);
        this.bridgePort.onDisconnect.addListener(this.onBridgeDisconnect);

        this.bridgePort.postMessage({
            subject: "bridge:startDiscovery",
            data: {
                // Also send back status messages
                shouldWatchStatus: true
            }
        });
    }

    /** Gets a list of receiver devices. */
    getDevices() {
        return Array.from(this.receiverDevices.values());
    }
    /** Gets a device by ID. */
    getDeviceById(deviceId: string) {
        return this.receiverDevices.get(deviceId);
    }

    /** Sends an NS_RECEIVER message to a given device. */
    sendReceiverMessage(deviceId: string, message: SenderMessage) {
        if (!this.bridgePort) {
            logger.error(
                "Failed to send receiver message (no bridge connection)"
            );
            return;
        }

        const device = this.receiverDevices.get(deviceId);
        if (!device) {
            logger.error(
                "Failed to send receiver message (could not find device)"
            );
            return;
        }

        this.bridgePort?.postMessage({
            subject: "bridge:sendReceiverMessage",
            data: { deviceId, message }
        });
    }

    /** Sends an NS_MEDIA message to a given device. */
    sendMediaMessage(deviceId: string, message: SenderMediaMessage) {
        if (!this.bridgePort) {
            logger.error("Failed to send media message (no bridge connection)");
            return;
        }

        const device = this.receiverDevices.get(deviceId);
        if (!device) {
            logger.error(
                "Failed to send media message (could not find device)"
            );
            return;
        }

        this.bridgePort?.postMessage({
            subject: "bridge:sendMediaMessage",
            data: { deviceId, message }
        });
    }

    private onBridgeMessage = (message: Message) => {
        switch (message.subject) {
            case "main:deviceUp": {
                const { deviceId, deviceInfo } = message.data;

                this.receiverDevices.set(deviceId, deviceInfo);

                // Sort devices by friendly name
                this.receiverDevices = new Map(
                    [...this.receiverDevices].sort(([, deviceA], [, deviceB]) =>
                        deviceA.friendlyName.localeCompare(deviceB.friendlyName)
                    )
                );

                this.dispatchEvent(
                    new CustomEvent("deviceUp", {
                        detail: { deviceInfo }
                    })
                );

                break;
            }

            case "main:deviceDown": {
                const { deviceId } = message.data;

                if (this.receiverDevices.has(deviceId)) {
                    this.receiverDevices.delete(deviceId);
                }
                this.dispatchEvent(
                    new CustomEvent("deviceDown", {
                        detail: { deviceId: deviceId }
                    })
                );

                break;
            }

            case "main:receiverDeviceStatusUpdated": {
                const { deviceId, status } = message.data;
                const device = this.receiverDevices.get(deviceId);
                if (!device) break;

                // Clear media status when app status changes
                const application = status.applications?.[0];
                if (!application || application.isIdleScreen) {
                    delete device.mediaStatus;
                }

                device.status = status;

                this.dispatchEvent(
                    new CustomEvent("deviceUpdated", {
                        detail: {
                            deviceId,
                            status: device.status
                        }
                    })
                );

                break;
            }

            case "main:receiverDeviceMediaStatusUpdated": {
                const { deviceId, status } = message.data;
                const device = this.receiverDevices.get(deviceId);
                if (!device) break;

                if (device.mediaStatus) {
                    device.mediaStatus = { ...device.mediaStatus, ...status };
                    if (status.playerState === PlayerState.IDLE) {
                        delete device.mediaStatus.media;
                    }
                } else {
                    device.mediaStatus = status;
                }

                this.dispatchEvent(
                    new CustomEvent("deviceMediaUpdated", {
                        detail: {
                            deviceId,
                            status: device.mediaStatus
                        }
                    })
                );

                break;
            }
        }
    };

    private onBridgeDisconnect = () => {
        // Notify listeners of device availablility
        for (const [, receiverDevice] of this.receiverDevices) {
            const event = new CustomEvent("deviceDown", {
                detail: { deviceId: receiverDevice.id }
            });

            this.dispatchEvent(event);
        }

        this.receiverDevices.clear();

        // Re-initialize after 10 seconds
        window.setTimeout(() => {
            this.refresh();
        }, 10000);
    };
})();
