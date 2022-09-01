"use strict";

import bridge from "../lib/bridge";
import {
    BaseConfig,
    baseConfigStorage,
    getAppTag
} from "../lib/chromecastConfigApi";
import logger from "../lib/logger";
import messaging, { Message, Port } from "../messaging";
import options from "../lib/options";
import { getMediaTypesForPageUrl, stringify } from "../lib/utils";
import type { TypedMessagePort } from "../lib/TypedMessagePort";

import {
    ReceiverSelectorAppInfo,
    ReceiverSelectorMediaType,
    ReceiverSelectorPageInfo
} from "../types";

import type { ApiConfig } from "../cast/sdk/classes";
import { ReceiverAction } from "../cast/sdk/enums";
import { DEFAULT_MEDIA_RECEIVER_APP_ID } from "../cast/sdk/media";
import { createReceiver } from "../cast/utils";

import deviceManager from "./deviceManager";

import ReceiverSelector, {
    ReceiverSelection,
    ReceiverSelectorMediaMessage,
    ReceiverSelectorReceiverMessage
} from "./ReceiverSelector";

type AnyPort = Port | TypedMessagePort<Message>;

export interface ContentContext {
    tabId: number;
    frameId: number;
}

interface CastSession {
    sessionId: string;
    deviceId: string;
}

export interface CastInstance {
    bridgePort: Port;
    contentPort: AnyPort;
    contentContext?: ContentContext;

    /** From an extension-source, grants additional permissions. */
    isTrusted: boolean;

    /** ApiConfig provided on initialization. */
    apiConfig?: ApiConfig;
    /** Established session details. */
    session?: CastSession;
}

/** Creates a cast instance object and associated bridge instance. */
async function createCastInstance(opts: {
    bridgePort?: Port;
    contentPort: AnyPort;
    contentContext?: { tabId: number; frameId?: number };
    isTrusted?: boolean;
}) {
    const instance: CastInstance = {
        bridgePort: opts.bridgePort ?? (await bridge.connect()),
        contentPort: opts.contentPort,
        isTrusted: opts.isTrusted ?? false
    };

    /**
     * Set content context with fallback to extension message sender
     * context for content scripts.
     */
    if (opts.contentContext) {
        instance.contentContext = {
            tabId: opts.contentContext.tabId,
            frameId: opts.contentContext.frameId ?? 0
        };
    } else if (
        !(opts.contentPort instanceof MessagePort) &&
        opts.contentPort.sender?.tab?.id
    ) {
        instance.contentContext = {
            tabId: opts.contentPort.sender.tab.id,
            frameId: opts.contentPort.sender.frameId ?? 0
        };
    }

    return instance;
}

/** Disconnects either instance content port type. */
function disconnectContentPort(port: AnyPort) {
    if (port instanceof MessagePort) {
        port.close();
    } else {
        port.disconnect();
    }
}

/** Checks if two content contexts match. */
function isSameContext(ctx1?: ContentContext, ctx2?: ContentContext) {
    if (!ctx1 || !ctx2) return false;
    return ctx1?.tabId === ctx2?.tabId && ctx1?.frameId === ctx2?.frameId;
}

let baseConfig: BaseConfig;
let receiverSelector: Optional<ReceiverSelector>;

/** Keeps track of cast API instances and provides bridge messaging. */
const castManager = new (class {
    private activeInstances = new Set<CastInstance>();

    async init() {
        // Handle incoming instance connections
        messaging.onConnect.addListener(async port => {
            if (port.name === "cast") {
                this.createInstance(port);
            } else if (port.name === "trusted-cast") {
                // Create trusted instance
                this.createInstance(port, undefined, true);
            }
        });

        // Pass receiver availability updates to cast API.
        const updateReceiverAvailability = () => {
            const isAvailable = deviceManager.getDevices().length > 0;

            for (const instance of this.activeInstances) {
                instance.contentPort.postMessage({
                    subject: "cast:receiverAvailabilityUpdated",
                    data: { isAvailable }
                });
            }
        };

        deviceManager.addEventListener("deviceUp", updateReceiverAvailability);
        deviceManager.addEventListener(
            "deviceDown",
            updateReceiverAvailability
        );
    }

    /**
     * Finds a cast instance at the given tab (and optionally frame) ID.
     */
    getInstanceAt(tabId: number, frameId?: number) {
        for (const instance of this.activeInstances) {
            if (instance.contentContext?.tabId === tabId) {
                // If frame ID doesn't match go to next instance
                if (frameId && instance.contentContext.frameId !== frameId) {
                    continue;
                }

                return instance;
            }
        }
    }

    getInstanceByDeviceId(deviceId: string) {
        for (const instance of this.activeInstances) {
            if (instance.session?.deviceId === deviceId) return instance;
        }
    }

    /**
     * Creates a cast instance with a given port and connects messaging
     * correctly depending on the type of port.
     */
    async createInstance(
        port: AnyPort,
        contentContext?: ContentContext,
        isTrusted?: boolean
    ) {
        const instance = await (port instanceof MessagePort
            ? this.createInstanceFromBackground(port, contentContext)
            : this.createInstanceFromContent(port, isTrusted));

        this.activeInstances.add(instance);

        instance.contentPort.postMessage({
            subject: "cast:instanceCreated",
            data: { isAvailable: (await bridge.getInfo()).isVersionCompatible }
        });

        return instance;
    }

    /** Creates a cast instance with a `MessagePort` content port. */
    private async createInstanceFromBackground(
        contentPort: MessagePort,
        contentContext?: ContentContext
    ): Promise<CastInstance> {
        const instance = await createCastInstance({
            bridgePort: await bridge.connect(),
            contentPort,
            contentContext,
            isTrusted: true
        });

        // Ensure only one instance per context
        if (contentContext) {
            for (const instance of this.activeInstances) {
                if (isSameContext(instance.contentContext, contentContext)) {
                    instance.bridgePort.disconnect();
                    this.activeInstances.delete(instance);
                    break;
                }
            }
        }

        instance.bridgePort.onDisconnect.addListener(() => {
            contentPort.close();
            this.activeInstances.delete(instance);
        });

        // bridge -> cast instance
        instance.bridgePort.onMessage.addListener(message => {
            this.handleBridgeMessage(instance, message);
        });

        // cast instance -> (any)
        contentPort.addEventListener("message", ev => {
            this.handleContentMessage(instance, ev.data);
        });
        contentPort.start();

        return instance;
    }

    /**
     * Creates a cast instance with a WebExtension `Port` content port.
     */
    private async createInstanceFromContent(
        contentPort: Port,
        isTrusted?: boolean
    ): Promise<CastInstance> {
        if (
            contentPort.sender?.tab?.id === undefined ||
            contentPort.sender?.frameId === undefined
        ) {
            throw logger.error(
                "Cast instance created from content with an invalid port context."
            );
        }

        // Ensure only one instance per context
        for (const instance of this.activeInstances) {
            if (
                isSameContext(
                    instance.contentContext,
                    contentPort.sender as ContentContext
                )
            ) {
                instance.bridgePort.disconnect();
                disconnectContentPort(instance.contentPort);
                break;
            }
        }

        const instance = await createCastInstance({ contentPort, isTrusted });

        // cast instance -> (any)
        const onContentPortMessage = (message: Message) => {
            this.handleContentMessage(instance, message);
        };
        // bridge -> cast instance
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
            case "main:castSessionCreated": {
                // Close after session is created
                if (
                    receiverSelector?.isOpen &&
                    // If selector context is the same as the instance context
                    isSameContext(
                        receiverSelector.pageInfo,
                        instance.contentContext
                    ) &&
                    // If selector is supposed to close
                    (await options.get("receiverSelectorWaitForConnection"))
                ) {
                    receiverSelector.close();
                }

                const { receiverId: deviceId } = message.data;

                instance.session = {
                    deviceId,
                    sessionId: message.data.sessionId
                };

                const device = deviceManager.getDeviceById(deviceId);
                if (!device) {
                    logger.error(
                        "[on main:castSessionCreated]: Could not find device with ID:",
                        deviceId
                    );
                    break;
                }

                instance.contentPort.postMessage({
                    subject: "cast:sessionCreated",
                    data: {
                        ...message.data,
                        receiver: createReceiver(device)
                    }
                });

                break;
            }

            case "main:castSessionUpdated":
                instance.contentPort.postMessage({
                    subject: "cast:sessionUpdated",
                    data: message.data
                });
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
            case "main:initializeCastSdk":
                instance.apiConfig = message.data.apiConfig;
                instance.contentPort.postMessage({
                    subject: "cast:receiverAvailabilityUpdated",
                    data: {
                        isAvailable: deviceManager.getDevices().length > 0
                    }
                });

                break;

            // User has triggered receiver selection via the cast API
            case "main:requestSession": {
                const { sessionRequest, receiverDevice } = message.data;

                // Handle trusted instance receiver selection bypass
                if (receiverDevice) {
                    if (!instance.isTrusted) {
                        logger.error(
                            "Cast instance not trusted to bypass receiver selection!"
                        );
                        break;
                    }

                    instance.bridgePort.postMessage({
                        subject: "bridge:createCastSession",
                        data: {
                            appId: sessionRequest.appId,
                            receiverDevice
                        }
                    });

                    break;
                }

                try {
                    const selection = await getReceiverSelection({
                        castInstance: instance
                    });

                    // Handle cancellation
                    if (!selection) {
                        instance.contentPort.postMessage({
                            subject: "cast:sessionRequestCancelled"
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
                            subject: "cast:sessionRequestCancelled"
                        });

                        if (!instance.contentContext) {
                            throw logger.error("Missing content context");
                        }
                        this.loadSender(selection, instance.contentContext);

                        break;
                    }

                    instance.bridgePort.postMessage({
                        subject: "bridge:createCastSession",
                        data: {
                            appId: sessionRequest.appId,
                            receiverDevice: selection.receiverDevice
                        }
                    });
                } catch (err) {
                    // TODO: Report errors properly
                    instance.contentPort.postMessage({
                        subject: "cast:sessionRequestCancelled"
                    });
                }

                break;
            }
        }
    }

    /**
     * Gets a receiver selection and loads the appropriate sender for a
     * given context.
     */
    async triggerCast(tabId: number, frameId = 0) {
        let selection: Nullable<ReceiverSelection>;
        try {
            selection = await getReceiverSelection({ tabId, frameId });
        } catch (err) {
            logger.error("Failed to get receiver selection (triggerCast)", err);
            return;
        }

        if (!selection) return;

        this.loadSender(selection, { tabId, frameId });
    }

    /**
     * Loads the appropriate sender for a given receiver selector
     * response.
     */
    private async loadSender(
        selection: ReceiverSelection,
        contentContext: ContentContext
    ) {
        // Cancelled
        if (!selection) {
            return;
        }

        switch (selection.mediaType) {
            case ReceiverSelectorMediaType.App: {
                const instance = this.getInstanceAt(
                    contentContext.tabId,
                    contentContext.frameId
                );
                if (!instance) {
                    throw logger.error(
                        `Cast instance not found at tabId ${contentContext.tabId} / frameId ${contentContext.frameId}`
                    );
                }

                if (!instance.apiConfig?.sessionRequest.appId) {
                    throw logger.error("Invalid session request");
                }

                instance.contentPort.postMessage({
                    subject: "cast:receiverAction",
                    data: {
                        receiver: createReceiver(selection.receiverDevice),
                        action: ReceiverAction.CAST
                    }
                });

                instance.bridgePort.postMessage({
                    subject: "bridge:createCastSession",
                    data: {
                        appId: instance.apiConfig?.sessionRequest.appId,
                        receiverDevice: selection.receiverDevice
                    }
                });

                break;
            }

            case ReceiverSelectorMediaType.Tab:
            case ReceiverSelectorMediaType.Screen:
                await browser.tabs.executeScript(contentContext.tabId, {
                    code: stringify`
                        window.mirroringMediaType = ${selection.mediaType};
                        window.receiverDevice = ${selection.receiverDevice};
                        window.contextTabId = ${contentContext.tabId};
                    `,
                    frameId: contentContext.frameId
                });

                await browser.tabs.executeScript(contentContext.tabId, {
                    file: "cast/senders/mirroring.js",
                    frameId: contentContext.frameId
                });

                break;
        }
    }
})();

/**
 * Opens a receiver selector with the specified default/available media
 * types.
 *
 * Returns a promise that:
 *   - Resolves to a ReceiverSelection object if selection is
 *      successful.
 *   - Resolves to null if the selection is cancelled.
 *   - Rejects if the selection fails.
 */
async function getReceiverSelection(selectionOpts: {
    tabId?: number;
    frameId?: number;
    castInstance?: CastInstance;
}): Promise<ReceiverSelection | null> {
    /**
     * If the current context is running the mirroring app, pretend
     * it doesn't exist because it shouldn't be launched like this.
     */
    if (
        selectionOpts.castInstance?.apiConfig?.sessionRequest.appId ===
        (await options.get("mirroringAppId"))
    ) {
        selectionOpts.castInstance = undefined;
    }

    let defaultMediaType = ReceiverSelectorMediaType.Tab;
    let availableMediaTypes = ReceiverSelectorMediaType.None;

    // Default frame ID
    if (selectionOpts.frameId === undefined) selectionOpts.frameId = 0;

    // Fallback to instance context
    if (
        selectionOpts.tabId === undefined &&
        selectionOpts.castInstance?.contentContext
    ) {
        selectionOpts.tabId = selectionOpts.castInstance.contentContext.tabId;
        selectionOpts.frameId =
            selectionOpts.castInstance.contentContext.frameId;
    }

    const opts = await options.getAll();

    /**
     * If context supplied, but no instance, check for an instance at
     * that context.
     */
    if (
        !selectionOpts.castInstance &&
        selectionOpts.tabId !== undefined &&
        selectionOpts.frameId !== undefined
    ) {
        const contextInstance = castManager.getInstanceAt(
            selectionOpts.tabId,
            selectionOpts.frameId
        );
        /**
         * If the app in that context is the extension mirroring app or
         * the default receiver, just ignore it.
         */
        const contextAppId = contextInstance?.apiConfig?.sessionRequest.appId;
        if (
            contextAppId !== opts.mirroringAppId &&
            contextAppId !== DEFAULT_MEDIA_RECEIVER_APP_ID
        ) {
            selectionOpts.castInstance = contextInstance;
        }
    }

    let pageInfo: Optional<ReceiverSelectorPageInfo>;
    if (selectionOpts.tabId !== undefined) {
        try {
            pageInfo = {
                tabId: selectionOpts.tabId,
                frameId: selectionOpts.frameId,
                url: (
                    await browser.webNavigation.getFrame({
                        tabId: selectionOpts.tabId,
                        frameId: selectionOpts.frameId
                    })
                ).url
            };

            availableMediaTypes = getMediaTypesForPageUrl(pageInfo.url);
        } catch {
            logger.error(
                "Failed to locate frame, falling back to default available media types."
            );
        }
    }

    // Enable app media type if sender application is present
    if (selectionOpts.castInstance) {
        defaultMediaType = ReceiverSelectorMediaType.App;
        availableMediaTypes |= ReceiverSelectorMediaType.App;
    }

    // Disable mirroring media types if mirroring is not enabled
    if (!opts.mirroringEnabled) {
        availableMediaTypes &= ~(
            ReceiverSelectorMediaType.Tab | ReceiverSelectorMediaType.Screen
        );
    }

    // Ensure status manager is initialized
    await deviceManager.init();

    let appInfo: Optional<ReceiverSelectorAppInfo>;
    if (selectionOpts.castInstance?.apiConfig) {
        if (!baseConfig) {
            try {
                baseConfig = (await baseConfigStorage.get("baseConfig"))
                    .baseConfig;
            } catch (err) {
                throw logger.error("Failed to get Chromecast base config!");
            }
        }

        appInfo = {
            sessionRequest:
                selectionOpts.castInstance.apiConfig?.sessionRequest,
            isRequestAppAudioCompatible: getAppTag(
                baseConfig,
                selectionOpts.castInstance.apiConfig?.sessionRequest.appId
            )?.supports_audio_only
        };
    }

    return new Promise(async (resolve, reject) => {
        // Close an existing open selector
        if (receiverSelector?.isOpen) {
            await receiverSelector.close();
        }
        receiverSelector = createSelector();

        // Handle selected return value
        const onSelected = (ev: CustomEvent<ReceiverSelection>) =>
            resolve(ev.detail);
        receiverSelector.addEventListener("selected", onSelected);

        // Handle cancelled return value
        const onCancelled = () => resolve(null);
        receiverSelector.addEventListener("cancelled", onCancelled);

        const onError = (ev: CustomEvent<string>) => reject(ev.detail);
        receiverSelector.addEventListener("error", onError);

        // Cleanup listeners
        receiverSelector.addEventListener(
            "close",
            () => {
                receiverSelector?.removeEventListener("selected", onSelected);
                receiverSelector?.removeEventListener("cancelled", onCancelled);
                receiverSelector?.removeEventListener("error", onError);
            },
            { once: true }
        );

        receiverSelector.open({
            receiverDevices: deviceManager.getDevices(),
            defaultMediaType,
            availableMediaTypes,
            appInfo,
            pageInfo
        });
    });
}

/**
 * Creates new ReceiverSelector object and adds listeners for
 * updates/messages.
 */
function createSelector() {
    // Get a new selector for each selection
    const selector = new ReceiverSelector();

    /**
     * Sends message to cast instance to trigger stopped receiver action
     * (if applicable).
     */
    const onStop = (ev: CustomEvent<{ deviceId: string }>) => {
        const castInstance = castManager.getInstanceByDeviceId(
            ev.detail.deviceId
        );
        if (!castInstance) return;

        const device = deviceManager.getDeviceById(ev.detail.deviceId);
        if (!device) return;

        castInstance.contentPort.postMessage({
            subject: "cast:receiverAction",
            data: {
                receiver: createReceiver(device),
                action: ReceiverAction.STOP
            }
        });
    };
    selector.addEventListener("stop", onStop);

    // Forward receiver messages
    const onReceiverMessage = (
        ev: CustomEvent<ReceiverSelectorReceiverMessage>
    ) =>
        deviceManager.sendReceiverMessage(
            ev.detail.deviceId,
            ev.detail.message
        );
    selector.addEventListener("receiverMessage", onReceiverMessage);

    // Forward media messages
    const onMediaMessage = (ev: CustomEvent<ReceiverSelectorMediaMessage>) =>
        deviceManager.sendMediaMessage(ev.detail.deviceId, ev.detail.message);
    selector.addEventListener("mediaMessage", onMediaMessage);

    // Update selector data whenever devices change/update
    const onDeviceChange = () => selector.update(deviceManager.getDevices());

    deviceManager.addEventListener("deviceUp", onDeviceChange);
    deviceManager.addEventListener("deviceDown", onDeviceChange);
    deviceManager.addEventListener("deviceUpdated", onDeviceChange);
    deviceManager.addEventListener("deviceMediaUpdated", onDeviceChange);

    // Cleanup listeners
    selector.addEventListener(
        "close",
        () => {
            deviceManager.removeEventListener("deviceUp", onDeviceChange);
            deviceManager.removeEventListener("deviceDown", onDeviceChange);
            deviceManager.removeEventListener("deviceUpdated", onDeviceChange);
            deviceManager.removeEventListener(
                "deviceMediaUpdated",
                onDeviceChange
            );

            selector.removeEventListener("stop", onStop);
            selector.removeEventListener("receiverMessage", onReceiverMessage);
            selector.removeEventListener("mediaMessage", onMediaMessage);
        },
        { once: true }
    );

    return selector;
}

export default castManager;
