import bridge from "../lib/bridge";
import {
    BaseConfig,
    baseConfigStorage,
    getAppTag
} from "../lib/chromecastConfigApi";
import logger from "../lib/logger";
import messaging, { Message, Port } from "../messaging";
import options from "../lib/options";
import type { TypedMessagePort } from "../lib/TypedMessagePort";

import {
    ReceiverDevice,
    ReceiverSelectorAppInfo,
    ReceiverSelectorMediaType,
    ReceiverSelectorPageInfo
} from "../types";

import type { ApiConfig } from "../cast/sdk/classes";
import { AutoJoinPolicy, ReceiverAction } from "../cast/sdk/enums";
import { createReceiver } from "../cast/utils";

import ReceiverSelector, {
    ReceiverSelection,
    ReceiverSelectorMediaMessage,
    ReceiverSelectorReceiverMessage
} from "./ReceiverSelector";

import deviceManager from "./deviceManager";
import { ActionState, updateActionState } from "./action";

type AnyPort = Port | TypedMessagePort<Message>;

export interface ContentContext {
    tabId: number;
    frameId: number;
    origin?: string;
}

/** Checks if two content contexts match. */
function isSameContext(ctx1?: ContentContext, ctx2?: ContentContext) {
    if (!ctx1 || !ctx2) return false;
    return ctx1?.tabId === ctx2?.tabId && ctx1?.frameId === ctx2?.frameId;
}

interface CastSession {
    bridgePort: Port;
    deviceId: string;
    appId: string;
    sessionId?: string;
    autoJoinContexts: Set<ContentContext>;
}

/** Creates a cast session object and sets up messaging. */
async function createCastSession(opts: {
    deviceId: string;
    instance: CastInstance;
    appId?: string;
}) {
    // If not explicitly provided, use session request app ID
    if (!opts.appId) {
        if (!opts.instance.apiConfig?.sessionRequest) {
            throw logger.error(
                "App ID not provided and instance missing valid session request!"
            );
        }
        opts.appId = opts.instance.apiConfig.sessionRequest.appId;
    }

    const session: CastSession = {
        bridgePort: await bridge.connect(),
        deviceId: opts.deviceId,
        appId: opts.appId,
        autoJoinContexts: new Set()
    };

    if (opts.instance.contentContext) {
        session.autoJoinContexts.add(opts.instance.contentContext);
    }

    opts.instance.session = session;
    opts.instance.bridgeMessageListener = message => {
        handleBridgeMessage(opts.instance, message);
    };

    session.bridgePort.onMessage.addListener(
        opts.instance.bridgeMessageListener
    );
    session.bridgePort.onDisconnect.addListener(() =>
        destroyCastInstance(opts.instance)
    );

    if (opts.instance.contentContext?.tabId) {
        updateActionState(
            ActionState.Connecting,
            opts.instance.contentContext?.tabId
        );
    }

    return session;
}

function joinSession(instance: CastInstance, session: CastSession) {
    if (!session.sessionId) return;

    instance.session = session;
    instance.bridgeMessageListener = message =>
        handleBridgeMessage(instance, message);

    session.bridgePort.onMessage.addListener(instance.bridgeMessageListener);
    session.bridgePort.onDisconnect.addListener(() =>
        destroyCastInstance(instance)
    );

    const device = deviceManager.getDeviceById(session.deviceId);
    if (!device?.status?.applications?.length) {
        throw logger.error("Invalid device state!");
    }

    /**
     * Re-create sessionCreated message. Since the
     * sender app hasn't requested a session, this
     * will be handled by calling the session
     * listener.
     */
    const application = device?.status?.applications[0];
    instance.contentPort.postMessage({
        subject: "cast:sessionCreated",
        data: {
            appId: application.appId,
            appImages: [],
            displayName: application.displayName,
            namespaces: application.namespaces,
            receiverFriendlyName: device.friendlyName,
            receiverId: device.id,
            senderApps: [],
            sessionId: session.sessionId,
            statusText: application.statusText,
            transportId: session.sessionId,
            volume: device.status.volume,

            receiver: createReceiver(device),
            media: device.mediaStatus
        }
    });

    if (instance.contentContext?.tabId) {
        updateActionState(
            ActionState.Connected,
            instance.contentContext?.tabId
        );
    }
}

function leaveSession(instance: CastInstance) {
    if (!instance.session?.sessionId) return;

    instance.contentPort.postMessage({
        subject: "cast:sessionDisconnected",
        data: { sessionId: instance.session.sessionId }
    });

    delete instance.session;
    if (instance.contentContext?.tabId) {
        updateActionState(ActionState.Default, instance.contentContext.tabId);
    }
}

export interface CastInstance {
    contentPort: AnyPort;
    contentContext?: ContentContext;

    /** From an extension-source, grants additional permissions. */
    isTrusted: boolean;

    /** ApiConfig provided on initialization. */
    apiConfig?: ApiConfig;
    /** Established session details. */
    session?: CastSession;

    /** Listener for bridge messages. */
    bridgeMessageListener?: (message: Message) => void;
}

/** Creates a cast instance object and associated bridge instance. */
function createCastInstance(opts: {
    contentPort: AnyPort;
    contentContext?: { tabId: number; frameId?: number };
    isTrusted?: boolean;
}) {
    const instance: CastInstance = {
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
        // Get origin from content port
        let origin: Optional<string>;
        if (opts.contentPort.sender?.tab?.url) {
            try {
                ({ origin } = new URL(opts.contentPort.sender.tab.url));
                // eslint-disable-next-line no-empty
            } catch {}
        }

        instance.contentContext = {
            tabId: opts.contentPort.sender.tab.id,
            frameId: opts.contentPort.sender.frameId ?? 0,
            origin
        };
    }

    return instance;
}

/** Removes cast instance and disconnects messaging ports. */
function destroyCastInstance(instance: CastInstance) {
    if (instance.contentPort instanceof MessagePort) {
        instance.contentPort.close();
    } else {
        instance.contentPort.disconnect();
    }

    if (instance.session && instance.bridgeMessageListener) {
        instance.session.bridgePort.onMessage.removeListener(
            instance.bridgeMessageListener
        );
    }

    if (instance.contentContext?.tabId) {
        updateActionState(ActionState.Default, instance.contentContext?.tabId);
    }

    activeInstances.delete(instance);
}

/**
 * Check instance's auto join policy against a content context to
 * determine if it's a valid auto join target.
 */
function isValidAutoJoinContext(
    instance: CastInstance,
    context: ContentContext
) {
    if (!instance.apiConfig?.autoJoinPolicy) return false;

    const { autoJoinPolicy } = instance.apiConfig;
    if (
        autoJoinPolicy === AutoJoinPolicy.ORIGIN_SCOPED ||
        autoJoinPolicy === AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED
    ) {
        // Check origin
        if (context.origin !== instance.contentContext?.origin) return false;
        // If tab-scoped, check context
        if (
            autoJoinPolicy === AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED &&
            !isSameContext(context, instance.contentContext)
        )
            return false;

        return true;
    }

    return false;
}

interface AutoJoinTarget {
    session: CastSession;
    autoJoinContext: ContentContext;
}
function findAutoJoinTarget(instance: CastInstance) {
    for (const [, session] of activeSessions) {
        if (
            !session.sessionId ||
            session.appId !== instance.apiConfig?.sessionRequest.appId
        )
            continue;

        for (const context of session.autoJoinContexts) {
            if (isValidAutoJoinContext(instance, context)) {
                return { session, autoJoinContext: context } as AutoJoinTarget;
            }
        }
    }
}

/** Whitelist of safe message types from content. */
const allowedContentMessages: Array<Message["subject"]> = [
    "main:initializeCastSdk",
    "main:requestSession",
    "main:requestSessionById",
    "main:leaveSession",
    "bridge:sendCastReceiverMessage",
    "bridge:sendCastSessionMessage"
];

/** Chromecast base config to check compatibility with audio devices. */
let baseConfig: BaseConfig;
/** Shared receiver selector. */
let receiverSelector: Optional<ReceiverSelector>;

/** Set of active cast instances.  */
const activeInstances = new Set<CastInstance>();

/** Map of active session IDs to session info objects. */
const activeSessions = new Map<string, CastSession>();

/** Keeps track of cast API instances and provides bridge messaging. */
const castManager = new (class {
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

        // Pass receiver availability updates to cast API
        const updateReceiverAvailability = () => {
            const isAvailable = deviceManager.getDevices().length > 0;

            for (const instance of activeInstances) {
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

        deviceManager.addEventListener("applicationClosed", ev => {
            const session = activeSessions.get(ev.detail.sessionId);
            if (!session?.sessionId) return;

            // Remove session from instances and notify SDK
            for (const instance of activeInstances) {
                if (instance.session === session) {
                    instance.contentPort.postMessage({
                        subject: "cast:sessionStopped",
                        data: { sessionId: session.sessionId }
                    });

                    delete instance.session;

                    if (instance.contentContext?.tabId) {
                        updateActionState(
                            ActionState.Default,
                            instance.contentContext.tabId
                        );
                    }
                }
            }

            activeSessions.delete(session.sessionId);
        });
    }

    /**
     * Finds a cast instance at the given tab (and optionally frame) ID.
     */
    getInstanceAt(tabId: number, frameId?: number) {
        for (const instance of activeInstances) {
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
        for (const instance of activeInstances) {
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

        activeInstances.add(instance);

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
            contentPort,
            contentContext,
            isTrusted: true
        });

        // Ensure only one instance per context
        if (contentContext) {
            for (const instance of activeInstances) {
                if (isSameContext(instance.contentContext, contentContext)) {
                    destroyCastInstance(instance);
                    break;
                }
            }
        }

        // cast instance -> (any)
        contentPort.addEventListener("message", ev => {
            handleContentMessage(instance, ev.data);
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

        const instance = await createCastInstance({ contentPort, isTrusted });

        // cast instance -> (any)
        const onContentPortMessage = (message: Message) => {
            handleContentMessage(instance, message);
        };

        contentPort.onMessage.addListener(onContentPortMessage);
        contentPort.onDisconnect.addListener(() => {
            destroyCastInstance(instance);
        });

        return instance;
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

        loadSender(selection, { tabId, frameId });
    }
})();

export default castManager;

/** Handles messages to cast instances from bridge. */
async function handleBridgeMessage(instance: CastInstance, message: Message) {
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

            if (!instance.session) {
                logger.error("Instance is missing session!");
                break;
            }

            instance.session.sessionId = message.data.sessionId;
            activeSessions.set(message.data.sessionId, instance.session);

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

            if (instance.contentContext?.tabId) {
                updateActionState(
                    ActionState.Connected,
                    instance.contentContext?.tabId
                );
            }

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
async function handleContentMessage(instance: CastInstance, message: Message) {
    // Limit untrusted instances to allowed messages subset
    if (
        !allowedContentMessages.includes(message.subject) &&
        !instance.isTrusted
    ) {
        logger.error(`Forbidden message type! (${message.subject})`);
        destroyCastInstance(instance);
        return;
    }

    const [destination] = message.subject.split(":");
    if (destination === "bridge") {
        instance.session?.bridgePort.postMessage(message);
    }

    switch (message.subject) {
        case "main:initializeCastSdk": {
            instance.apiConfig = message.data.apiConfig;
            instance.contentPort.postMessage({
                subject: "cast:receiverAvailabilityUpdated",
                data: {
                    isAvailable: deviceManager.getDevices().length > 0
                }
            });

            // No need to check for existing sessions if page-scoped
            if (
                instance.apiConfig.autoJoinPolicy === AutoJoinPolicy.PAGE_SCOPED
            ) {
                break;
            }

            // Check existing sessions for a valid auto join target
            const target = findAutoJoinTarget(instance);
            if (target) joinSession(instance, target.session);

            break;
        }

        // User has triggered receiver selection via the cast API
        case "main:requestSession": {
            const { sessionRequest, receiverDevice } = message.data;

            // Handle trusted instance receiver selection bypass
            if (receiverDevice) {
                if (receiverSelector?.isOpen && instance.contentContext) {
                    receiverSelector.pageInfo = {
                        ...instance.contentContext,
                        url: (
                            await browser.webNavigation.getFrame({
                                tabId: instance.contentContext?.tabId,
                                frameId: instance.contentContext?.frameId
                            })
                        ).url
                    };
                }

                if (!instance.isTrusted) {
                    logger.error(
                        "Cast instance not trusted to bypass receiver selection!"
                    );
                    destroyCastInstance(instance);
                    break;
                }

                const session = await createCastSession({
                    instance,
                    deviceId: receiverDevice.id,
                    appId: sessionRequest.appId
                });

                session.bridgePort.postMessage({
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
                    loadSender(selection, instance.contentContext);

                    break;
                }

                instance.contentPort.postMessage({
                    subject: "cast:receiverAction",
                    data: {
                        receiver: createReceiver(selection.device),
                        action: ReceiverAction.CAST
                    }
                });

                const session = await createCastSession({
                    instance,
                    deviceId: selection.device.id,
                    appId: sessionRequest.appId
                });

                session.bridgePort.postMessage({
                    subject: "bridge:createCastSession",
                    data: {
                        appId: sessionRequest.appId,
                        receiverDevice: selection.device
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

        case "main:requestSessionById": {
            const session = activeSessions.get(message.data.sessionId);
            if (!session) {
                logger.log(
                    `Session not found! (id: ${message.data.sessionId})`
                );
                break;
            }

            if (instance.apiConfig?.sessionRequest.appId === session.appId) {
                joinSession(instance, session);

                // If requesting by ID, add to the list of auto join contexts
                if (instance.contentContext) {
                    session.autoJoinContexts.add(instance.contentContext);
                }
            }

            break;
        }

        case "main:leaveSession": {
            if (!instance.contentContext || !instance.session?.sessionId) {
                logger.error("Cannot leave session, instance invalid!");
                break;
            }

            // Find auto join target for this instance
            const target = findAutoJoinTarget(instance);
            if (target) {
                // Remove auto join context for future instances
                instance.session.autoJoinContexts.delete(
                    target.autoJoinContext
                );

                const sessionAppId = instance.session.appId;
                leaveSession(instance);

                /**
                 * Disconnect other instances within the scope of this
                 * instances's auto join policy.
                 */
                for (const activeInstance of activeInstances) {
                    if (
                        (activeInstance === instance ||
                            activeInstance.session?.appId) !== sessionAppId
                    )
                        continue;

                    if (
                        isValidAutoJoinContext(
                            activeInstance,
                            target.autoJoinContext
                        )
                    ) {
                        leaveSession(activeInstance);
                    }
                }
            } else {
                leaveSession(instance);
            }
        }
    }
}

/**
 * Loads the appropriate sender for a given receiver selector response.
 */
async function loadSender(
    selection: ReceiverSelection,
    contentContext: ContentContext
) {
    // Cancelled
    if (!selection) {
        return;
    }

    switch (selection.mediaType) {
        case ReceiverSelectorMediaType.App: {
            const instance = castManager.getInstanceAt(
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
                    receiver: createReceiver(selection.device),
                    action: ReceiverAction.CAST
                }
            });

            const session = await createCastSession({
                instance,
                deviceId: selection.device.id
            });

            session.bridgePort.postMessage({
                subject: "bridge:createCastSession",
                data: {
                    appId: session.appId,
                    receiverDevice: selection.device
                }
            });

            break;
        }

        case ReceiverSelectorMediaType.Screen:
            await createMirroringPopup(selection.device);
            break;
    }
}

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

    let defaultMediaType = ReceiverSelectorMediaType.Screen;
    let availableMediaTypes = ReceiverSelectorMediaType.Screen;

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

        // Ignore extension senders
        if (!contextInstance?.isTrusted) {
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
        } catch (err) {
            logger.error("Failed to locate frame!", err);
        }
    }

    // Enable app media type if sender application is present
    if (selectionOpts.castInstance) {
        defaultMediaType = ReceiverSelectorMediaType.App;
        availableMediaTypes |= ReceiverSelectorMediaType.App;
    }

    // Disable mirroring media types if mirroring is not enabled
    if (!opts.mirroringEnabled) {
        availableMediaTypes &= ~ReceiverSelectorMediaType.Screen;
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
            devices: deviceManager.getDevices(),
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
    const selector = new ReceiverSelector(
        deviceManager.getBridgeInfo()?.isVersionCompatible ?? false
    );

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
    const onDeviceChange = () => {
        const connectedSessionIds: string[] = [];
        for (const instance of activeInstances) {
            if (instance.session?.sessionId) {
                connectedSessionIds.push(instance.session.sessionId);
            }
        }

        selector.update(
            deviceManager.getDevices(),
            deviceManager.getBridgeInfo()?.isVersionCompatible ?? false,
            connectedSessionIds
        );
    };

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

/** Creates and manages mirroring popup window. */
async function createMirroringPopup(device: ReceiverDevice) {
    let popup: browser.windows.Window;
    try {
        popup = await browser.windows.create({
            url: browser.runtime.getURL("ui/mirroring/index.html"),
            type: "popup",
            width: 400,
            height: 150
        });
    } catch (err) {
        logger.error("Failed to create mirroring popup!", err);
        return;
    }

    const onMirroringPopupMessage = (port: Port) => {
        if (
            port.sender?.tab?.windowId !== popup.id ||
            port.name !== "mirroring"
        ) {
            return;
        }

        port.postMessage({ subject: "mirroringPopup:init", data: { device } });
    };

    messaging.onConnect.addListener(onMirroringPopupMessage);

    browser.windows.onRemoved.addListener(function onWindowRemoved(windowId) {
        if (windowId !== popup.id) return;
        messaging.onConnect.removeListener(onMirroringPopupMessage);
        browser.windows.onRemoved.removeListener(onWindowRemoved);
    });
}
