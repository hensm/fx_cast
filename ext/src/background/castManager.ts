"use strict";

import bridge from "../lib/bridge";
import logger from "../lib/logger";
import messaging, { Message, Port } from "../messaging";
import options from "../lib/options";
import { stringify } from "../lib/utils";

import { ReceiverSelectorMediaType } from "../types";

import deviceManager from "./deviceManager";
import ReceiverSelector, { ReceiverSelection } from "./ReceiverSelector";

type AnyPort = Port | MessagePort;

export interface CastInstance {
    bridgePort: Port;
    contentPort: AnyPort;
    contentTabId?: number;
    contentFrameId?: number;
    appId?: string;
    session?: CastSession;
}

interface CastSession {
    sessionId: string;
    deviceId: string;
}

/** Keeps track of cast API instances and provides bridge messaging. */
export default new (class {
    private activeInstances = new Set<CastInstance>();

    public async init() {
        // Handle incoming instance connections
        messaging.onConnect.addListener(async port => {
            if (port.name === "cast") {
                this.createInstance(port);
            }
        });

        // Forward receiver eventes to cast instances
        deviceManager.addEventListener("deviceUp", ev => {
            for (const instance of this.activeInstances) {
                instance.contentPort.postMessage({
                    subject: "cast:receiverDeviceUp",
                    data: { receiverDevice: ev.detail.deviceInfo }
                });
            }
        });
        deviceManager.addEventListener("deviceDown", ev => {
            for (const instance of this.activeInstances) {
                instance.contentPort.postMessage({
                    subject: "cast:receiverDeviceDown",
                    data: { receiverDeviceId: ev.detail.deviceId }
                });
            }
        });
    }

    /**
     * Finds a cast instance at the given tab (and optionally frame) ID.
     */
    public getInstance(tabId: number, frameId?: number) {
        for (const instance of this.activeInstances) {
            if (instance.contentTabId === tabId) {
                // If frame ID doesn't match go to next instance
                if (frameId && instance.contentFrameId !== frameId) {
                    continue;
                }

                return instance;
            }
        }
    }

    public getInstanceByDeviceId(deviceId: string) {
        for (const instance of this.activeInstances) {
            if (instance.session?.deviceId === deviceId) return instance;
        }
    }

    /**
     * Creates a cast instance with a given port and connects messaging
     * correctly depending on the type of port.
     */
    public async createInstance(port: AnyPort) {
        const instance = await (port instanceof MessagePort
            ? this.createInstanceFromBackground(port)
            : this.createInstanceFromContent(port));

        this.activeInstances.add(instance);

        instance.contentPort.postMessage({
            subject: "cast:initialized",
            data: await bridge.getInfo()
        });

        return instance;
    }

    /** Creates a cast instance with a `MessagePort` content port. */
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

        // bridge -> content
        instance.bridgePort.onMessage.addListener(message => {
            this.handleBridgeMessage(instance, message);
        });

        // content -> (any)
        contentPort.addEventListener("message", ev => {
            this.handleContentMessage(instance, ev.data);
        });

        return instance;
    }

    /**
     * Creates a cast instance with a WebExtension `Port` content port.
     */
    private async createInstanceFromContent(
        contentPort: Port
    ): Promise<CastInstance> {
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
         *
         * TODO: Fix this behaviour!
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

        // content -> (any)
        const onContentPortMessage = (message: Message) => {
            this.handleContentMessage(instance, message);
        };
        // bridge -> content
        const onBridgePortMessage = (message: Message) => {
            this.handleBridgeMessage(instance, message);
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

    private async handleBridgeMessage(
        instance: CastInstance,
        message: Message
    ) {
        // Intercept messages to store relevant info
        switch (message.subject) {
            case "cast:sessionCreated":
                instance.session = {
                    deviceId: message.data.receiverId,
                    sessionId: message.data.sessionId
                };
                break;
        }

        instance.contentPort.postMessage(message);
    }

    /**
     * Handle content messages from the cast instance. These will either
     * be handled here in the background script or forwarded to the
     * bridge associated with the cast instance.
     */
    private async handleContentMessage(
        instance: CastInstance,
        message: Message
    ) {
        const [destination] = message.subject.split(":");
        if (destination === "bridge") {
            instance.bridgePort.postMessage(message);
        }

        switch (message.subject) {
            // Cast API has been initialized
            case "main:initializeCast": {
                instance.appId = message.data.appId;

                for (const receiverDevice of deviceManager.getDevices()) {
                    instance.contentPort.postMessage({
                        subject: "cast:receiverDeviceUp",
                        data: { receiverDevice }
                    });
                }

                break;
            }

            // User has triggered receiver selection via the cast API
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
                    const selection = await ReceiverSelector.getSelection(
                        instance.contentTabId,
                        instance.contentFrameId,
                        { sessionRequest: message.data.sessionRequest }
                    );

                    // Handle cancellation
                    if (!selection) {
                        instance.contentPort.postMessage({
                            subject: "cast:selectReceiver/cancelled"
                        });

                        break;
                    }

                    /**
                     * If the media type returned from the selector has
                     * been changed, we need to cancel the current
                     * sender and switch it out for the right one.
                     */
                    if (selection.mediaType !== ReceiverSelectorMediaType.App) {
                        instance.contentPort.postMessage({
                            subject: "cast:selectReceiver/cancelled"
                        });

                        this.loadSender({
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
                } catch (err) {
                    // TODO: Report errors properly
                    instance.contentPort.postMessage({
                        subject: "cast:selectReceiver/cancelled"
                    });
                }

                break;
            }

            /**
             * TODO: If we're closing a selector, make sure it's the
             * same one that caused the session creation.
             */
            case "main:closeReceiverSelector": {
                const selector = ReceiverSelector.sharedInstance;
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

    /**
     * Loads the appropriate sender for a given receiver selector
     * response.
     */
    public async loadSender(opts: {
        tabId: number;
        frameId?: number;
        selection: ReceiverSelection;
    }) {
        // Cancelled
        if (!opts.selection) {
            return;
        }

        switch (opts.selection.mediaType) {
            case ReceiverSelectorMediaType.App: {
                const instance = this.getInstance(opts.tabId, opts.frameId);
                if (!instance) {
                    throw logger.error(
                        `Cast instance not found at tabId ${opts.tabId} / frameId ${opts.frameId}`
                    );
                }

                instance.contentPort.postMessage({
                    subject: "cast:launchApp",
                    data: { receiverDevice: opts.selection.receiverDevice }
                });

                break;
            }

            case ReceiverSelectorMediaType.Tab:
            case ReceiverSelectorMediaType.Screen: {
                await browser.tabs.executeScript(opts.tabId, {
                    code: stringify`
                        window.selectedMedia = ${opts.selection.mediaType};
                        window.selectedReceiver = ${opts.selection.receiverDevice};
                    `,
                    frameId: opts.frameId
                });

                await browser.tabs.executeScript(opts.tabId, {
                    file: "cast/senders/mirroring.js",
                    frameId: opts.frameId
                });

                break;
            }

            case ReceiverSelectorMediaType.File: {
                const fileUrl = new URL(`file://${opts.selection.filePath}`);
                const { init } = await import("../cast/senders/media");

                init({
                    mediaUrl: fileUrl.href,
                    receiver: opts.selection.receiverDevice
                });

                break;
            }
        }
    }
})();
