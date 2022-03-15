"use strict";

import bridge from "../lib/bridge";
import loadSender from "../lib/loadSender";
import logger from "../lib/logger";
import messaging, { Message, Port } from "../messaging";
import options from "../lib/options";

import {
    ReceiverSelectionActionType,
    ReceiverSelectorMediaType
} from "./receiverSelector";

import ReceiverSelectorManager from "./receiverSelector/ReceiverSelectorManager";

import receiverDevices from "./receiverDevices";

type AnyPort = Port | MessagePort;

export interface CastInstance {
    bridgePort: Port;
    contentPort: AnyPort;
    contentTabId?: number;
    contentFrameId?: number;
    appId?: string;
}

export default new (class CastManager {
    private activeInstances = new Set<CastInstance>();

    public async init() {
        // Wait for "cast" ports
        messaging.onConnect.addListener(async port => {
            if (port.name === "cast") {
                this.createInstance(port);
            }
        });

        receiverDevices.addEventListener("receiverDeviceUp", ev => {
            for (const instance of this.activeInstances) {
                instance.contentPort.postMessage({
                    subject: "cast:serviceUp",
                    data: { receiverDevice: ev.detail.deviceInfo }
                });
            }
        });

        receiverDevices.addEventListener("receiverDeviceDown", ev => {
            for (const instance of this.activeInstances) {
                instance.contentPort.postMessage({
                    subject: "cast:serviceDown",
                    data: { receiverDeviceId: ev.detail.deviceId }
                });
            }
        });
    }

    public getInstance(tabId: number, frameId?: number) {
        for (const instance of this.activeInstances) {
            if (instance.contentTabId === tabId) {
                if (frameId && instance.contentFrameId !== frameId) {
                    continue;
                }

                return instance;
            }
        }
    }

    public async createInstance(port: AnyPort) {
        const instance = await (port instanceof MessagePort
            ? this.createInstanceFromBackground(port)
            : this.createInstanceFromContent(port));

        instance.contentPort.postMessage({
            subject: "cast:initialized",
            data: await bridge.getInfo()
        });

        this.activeInstances.add(instance);
    }

    private async createInstanceFromBackground(
        contentPort: MessagePort
    ): Promise<CastInstance> {
        const instance: CastInstance = {
            bridgePort: await bridge.connect(),
            contentPort
        };

        instance.bridgePort.onDisconnect.addListener(() => {
            contentPort.close();
            this.activeInstances.delete(instance);
        });

        instance.bridgePort.onMessage.addListener(message => {
            contentPort.postMessage(message);
        });

        contentPort.addEventListener("message", ev => {
            this.handleContentMessage(instance, ev.data);
        });

        return instance;
    }

    private async createInstanceFromContent(contentPort: Port): Promise<CastInstance> {
        if (
            contentPort.sender?.tab?.id === undefined ||
            contentPort.sender?.frameId === undefined
        ) {
            throw logger.error(
                "Cast instance created from content with an invalid port context."
            );
        }

        /**
         * If there's already an active instance for the sender
         * tab/frame ID, disconnect it.
         */
        for (const instance of this.activeInstances) {
            if (
                instance.contentTabId === contentPort.sender.tab.id &&
                instance.contentFrameId === contentPort.sender.frameId
            ) {
                instance.bridgePort.disconnect();
            }
        }

        const instance: CastInstance = {
            bridgePort: await bridge.connect(),
            contentPort,
            contentTabId: contentPort.sender.tab.id,
            contentFrameId: contentPort.sender.frameId
        };

        const onContentPortMessage = (message: Message) => {
            this.handleContentMessage(instance, message);
        };

        const onBridgePortMessage = (message: Message) => {
            contentPort.postMessage(message);
        };

        const onDisconnect = () => {
            instance.bridgePort.onMessage.removeListener(onBridgePortMessage);
            contentPort.onMessage.removeListener(onContentPortMessage);

            instance.bridgePort.disconnect();
            contentPort.disconnect();

            this.activeInstances.delete(instance);
        };

        instance.bridgePort.onDisconnect.addListener(onDisconnect);
        instance.bridgePort.onMessage.addListener(onBridgePortMessage);

        contentPort.onDisconnect.addListener(onDisconnect);
        contentPort.onMessage.addListener(onContentPortMessage);

        return instance;
    }

    private async handleContentMessage(instance: CastInstance, message: Message) {
        const [destination] = message.subject.split(":");
        if (destination === "bridge") {
            instance.bridgePort.postMessage(message);
        }

        switch (message.subject) {
            case "main:castReady": {
                instance.appId = message.data.appId;

                for (const receiverDevice of receiverDevices.getDevices()) {
                    instance.contentPort.postMessage({
                        subject: "cast:serviceUp",
                        data: { receiverDevice }
                    });
                }

                break;
            }

            case "main:selectReceiver": {
                if (
                    instance.contentTabId === undefined ||
                    instance.contentFrameId === undefined
                ) {
                    throw logger.error(
                        "Cast instance associated with content sender missing tab/frame ID"
                    );
                }

                try {
                    const selection =
                        await ReceiverSelectorManager.getSelection(
                            instance.contentTabId,
                            instance.contentFrameId
                        );

                    // Handle cancellation
                    if (!selection) {
                        instance.contentPort.postMessage({
                            subject: "cast:selectReceiver/cancelled"
                        });

                        break;
                    }

                    switch (selection.actionType) {
                        case ReceiverSelectionActionType.Cast: {
                            /**
                             * If the media type returned from the selector has
                             * been changed, we need to cancel the current
                             * sender and switch it out for the right one.
                             */
                            if (
                                selection.mediaType !==
                                ReceiverSelectorMediaType.App
                            ) {
                                instance.contentPort.postMessage({
                                    subject: "cast:selectReceiver/cancelled"
                                });

                                loadSender({
                                    tabId: instance.contentTabId,
                                    frameId: instance.contentFrameId,
                                    selection
                                });

                                break;
                            }

                            instance.contentPort.postMessage({
                                subject: "cast:selectReceiver/selected",
                                data: selection
                            });

                            break;
                        }

                        case ReceiverSelectionActionType.Stop: {
                            instance.contentPort.postMessage({
                                subject: "cast:selectReceiver/stopped",
                                data: selection
                            });

                            break;
                        }
                    }
                } catch (err) {
                    // TODO: Report errors properly
                    instance.contentPort.postMessage({
                        subject: "cast:selectReceiver/cancelled"
                    });
                }

                break;
            }

            /**
             * TODO: If we're closing a selector, make sure it's the same
             * one that caused the session creation.
             */
            case "main:sessionCreated": {
                const selector = await ReceiverSelectorManager.getSelector();
                const shouldClose = await options.get(
                    "receiverSelectorWaitForConnection"
                );

                if (selector.isOpen && shouldClose) {
                    selector.close();
                }

                break;
            }
        }
    }
})();
