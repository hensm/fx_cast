"use strict";

import logger from "../../lib/logger";

import {
    ReceiverDevice,
    ReceiverDeviceCapabilities as ReceiverDeviceCapabilities
} from "../../types";
import { ErrorCallback, SuccessCallback } from "../types";

import { onMessage, sendMessageResponse } from "../eventMessageChannel";

import {
    AutoJoinPolicy,
    Capability,
    DefaultActionPolicy,
    DialAppState,
    ErrorCode,
    ReceiverAction,
    ReceiverAvailability,
    ReceiverType,
    SenderPlatform,
    SessionStatus,
    VolumeControlType
} from "./enums";

import {
    ApiConfig,
    CredentialsData,
    DialRequest,
    Error as Error_,
    Image,
    Receiver,
    ReceiverDisplayStatus,
    SenderApplication,
    SessionRequest,
    Timeout,
    Volume
} from "./classes";

import Session from "./Session";

import media from "./media";
import { Message } from "../../messaging";

type ReceiverActionListener = (
    receiver: Receiver,
    receiverAction: string
) => void;

type RequestSessionSuccessCallback = (session: Session) => void;

/**
 * Create `chrome.cast.Receiver` object from receiver device info.
 */
function createReceiver(device: ReceiverDevice) {
    // Convert capabilities bitflag to string array
    const capabilities: Capability[] = [];
    if (device.capabilities & ReceiverDeviceCapabilities.VIDEO_OUT) {
        capabilities.push(Capability.VIDEO_OUT);
    } else if (device.capabilities & ReceiverDeviceCapabilities.VIDEO_IN) {
        capabilities.push(Capability.VIDEO_IN);
    } else if (device.capabilities & ReceiverDeviceCapabilities.AUDIO_OUT) {
        capabilities.push(Capability.AUDIO_OUT);
    } else if (device.capabilities & ReceiverDeviceCapabilities.AUDIO_IN) {
        capabilities.push(Capability.AUDIO_IN);
    } else if (
        device.capabilities & ReceiverDeviceCapabilities.MULTIZONE_GROUP
    ) {
        capabilities.push(Capability.MULTIZONE_GROUP);
    }

    const receiver = new Receiver(device.id, device.friendlyName, capabilities);

    // Currently only supports CAST receivers
    receiver.receiverType = ReceiverType.CAST;

    return receiver;
}

/** Cast SDK root class */
export default class {
    #receiverDevices = new Map<string, ReceiverDevice>();

    #apiConfig?: ApiConfig;
    #sessionRequest?: SessionRequest;

    #requestSessionSuccessCallback?: RequestSessionSuccessCallback;
    #requestSessionErrorCallback?: ErrorCallback;

    #sessions = new Map<string, Session>();
    #receiverActionListeners = new Set<ReceiverActionListener>();

    // Enums
    AutoJoinPolicy = AutoJoinPolicy;
    Capability = Capability;
    DefaultActionPolicy = DefaultActionPolicy;
    DialAppState = DialAppState;
    ErrorCode = ErrorCode;
    ReceiverAction = ReceiverAction;
    ReceiverAvailability = ReceiverAvailability;
    ReceiverType = ReceiverType;
    SenderPlatform = SenderPlatform;
    SessionStatus = SessionStatus;
    VolumeControlType = VolumeControlType;

    // Classes
    ApiConfig = ApiConfig;
    CredentialsData = CredentialsData;
    DialRequest = DialRequest;
    Error = Error_;
    Image = Image;
    Receiver = Receiver;
    ReceiverDisplayStatus = ReceiverDisplayStatus;
    SenderApplication = SenderApplication;
    SessionRequest = SessionRequest;
    Timeout = Timeout;
    Volume = Volume;
    Session = Session;

    media = media;

    VERSION = [1, 2];
    isAvailable = false;
    timeout = new Timeout();

    constructor() {
        onMessage(this.#onMessage.bind(this));
    }

    #sendSessionRequest(
        sessionRequest: SessionRequest,
        receiverDevice: ReceiverDevice
    ) {
        for (const listener of this.#receiverActionListeners) {
            listener(createReceiver(receiverDevice), ReceiverAction.CAST);
        }

        sendMessageResponse({
            subject: "bridge:createCastSession",
            data: {
                appId: sessionRequest.appId,
                receiverDevice: receiverDevice
            }
        });
    }

    #onMessage(message: Message) {
        switch (message.subject) {
            case "cast:initialized": {
                this.isAvailable = true;
                break;
            }

            /**
             * Once the bridge detects a session creation, session info
             * and data needed to create cast API objects is sent.
             */
            case "cast:sessionCreated": {
                // Notify background to close UI
                sendMessageResponse({
                    subject: "main:closeReceiverSelector"
                });

                const status = message.data;
                const receiverDevice = this.#receiverDevices.get(
                    status.receiverId
                );
                if (!receiverDevice) {
                    logger.error(
                        `Could not find receiver device "${status.receiverFriendlyName}" (${status.receiverId})`
                    );
                    break;
                }

                const receiver = createReceiver(receiverDevice);
                receiver.volume = status.volume;
                receiver.displayStatus = new ReceiverDisplayStatus(
                    status.statusText,
                    status.appImages
                );

                const session = new Session(
                    status.sessionId, //   sessionId
                    status.appId, //       appId
                    status.displayName, // displayName
                    status.appImages, //   appImages
                    receiver //            receiver
                );

                session.senderApps = status.senderApps;
                session.transportId = status.transportId;

                this.#sessions.set(session.sessionId, session);
            }
            // eslint-disable-next-line no-fallthrough
            case "cast:sessionUpdated": {
                const status = message.data;
                const session = this.#sessions.get(status.sessionId);
                if (!session) {
                    logger.error(`Session not found (${status.sessionId})`);
                    return;
                }

                session.statusText = status.statusText;
                session.namespaces = status.namespaces;
                session.receiver.volume = status.volume;

                /**
                 * If session created via requestSession, the success
                 * callback will be set, otherwise the session was created
                 * by the extension and the session listener should be
                 * called instead.
                 */
                if (this.#requestSessionSuccessCallback) {
                    this.#requestSessionSuccessCallback(session);
                    this.#requestSessionSuccessCallback = undefined;
                    this.#requestSessionErrorCallback = undefined;
                } else {
                    this.#apiConfig?.sessionListener(session);
                }

                break;
            }

            case "cast:sessionStopped": {
                const { sessionId } = message.data;
                const session = this.#sessions.get(sessionId);
                if (session) {
                    session.status = SessionStatus.STOPPED;

                    const updateListeners = session?._updateListeners;
                    if (updateListeners) {
                        for (const listener of updateListeners) {
                            listener(false);
                        }
                    }
                }

                break;
            }

            case "cast:receivedSessionMessage": {
                const { sessionId, namespace, messageData } = message.data;
                const session = this.#sessions.get(sessionId);
                if (session) {
                    const _messageListeners = session._messageListeners;
                    const listeners = _messageListeners.get(namespace);

                    if (listeners) {
                        for (const listener of listeners) {
                            listener(namespace, messageData);
                        }
                    }
                }

                break;
            }

            case "cast:impl_sendMessage": {
                const { sessionId, messageId, error } = message.data;

                const session = this.#sessions.get(sessionId);
                if (!session) {
                    break;
                }

                const callbacks = session._sendMessageCallbacks.get(messageId);
                if (callbacks) {
                    const [successCallback, errorCallback] = callbacks;

                    if (error) {
                        errorCallback?.(new Error_(error));
                        return;
                    }

                    successCallback?.();
                }

                break;
            }

            case "cast:receiverDeviceUp": {
                const { receiverDevice } = message.data;
                if (this.#receiverDevices.has(receiverDevice.id)) {
                    break;
                }

                this.#receiverDevices.set(receiverDevice.id, receiverDevice);

                if (this.#apiConfig) {
                    // Notify listeners of new cast destination
                    this.#apiConfig.receiverListener(
                        ReceiverAvailability.AVAILABLE
                    );
                }

                break;
            }

            case "cast:receiverDeviceDown": {
                const { receiverDeviceId } = message.data;

                this.#receiverDevices.delete(receiverDeviceId);

                if (this.#receiverDevices.size === 0) {
                    if (this.#apiConfig) {
                        this.#apiConfig.receiverListener(
                            ReceiverAvailability.UNAVAILABLE
                        );
                    }
                }

                break;
            }

            case "cast:selectReceiver/selected": {
                logger.info("Selected receiver");

                if (this.#sessionRequest) {
                    this.#sendSessionRequest(
                        this.#sessionRequest,
                        message.data.receiverDevice
                    );
                    this.#sessionRequest = undefined;
                }

                break;
            }

            case "cast:selectReceiver/stopped": {
                const { receiverDevice } = message.data;

                logger.info("Stopped receiver");

                if (this.#sessionRequest) {
                    this.#sessionRequest = undefined;

                    for (const listener of this.#receiverActionListeners) {
                        listener(
                            // TODO: Use existing receiver object?
                            createReceiver(receiverDevice),
                            ReceiverAction.STOP
                        );
                    }
                }

                break;
            }

            // Popup closed before session established
            case "cast:selectReceiver/cancelled": {
                if (this.#sessionRequest) {
                    this.#sessionRequest = undefined;

                    this.#requestSessionErrorCallback?.(
                        new Error_(ErrorCode.CANCEL)
                    );
                }

                break;
            }

            // Session request initiated via receiver selector
            case "cast:launchApp": {
                if (this.#sessionRequest) {
                    logger.error("Session request already in progress.");
                    break;
                }
                if (!this.#apiConfig?.sessionRequest) {
                    logger.error("Session request not found!");
                    break;
                }

                this.#sendSessionRequest(
                    this.#apiConfig.sessionRequest,
                    message.data.receiverDevice
                );

                break;
            }
        }
    }

    initialize(
        apiConfig: ApiConfig,
        successCallback?: SuccessCallback,
        errorCallback?: ErrorCallback
    ) {
        logger.info("cast.initialize");

        // Already initialized
        if (this.#apiConfig) {
            errorCallback?.(new Error_(ErrorCode.INVALID_PARAMETER));
            return;
        }

        this.#apiConfig = apiConfig;

        sendMessageResponse({
            subject: "main:initializeCast",
            data: { appId: this.#apiConfig.sessionRequest.appId }
        });

        successCallback?.();

        this.#apiConfig.receiverListener(
            this.#receiverDevices.size
                ? ReceiverAvailability.AVAILABLE
                : ReceiverAvailability.UNAVAILABLE
        );
    }

    requestSession(
        successCallback: RequestSessionSuccessCallback,
        errorCallback: ErrorCallback,
        newSessionRequest?: SessionRequest,
        receiverDevice?: ReceiverDevice
    ) {
        logger.info("cast.requestSession");

        // Not yet initialized
        if (!this.#apiConfig) {
            errorCallback?.(new Error_(ErrorCode.API_NOT_INITIALIZED));
            return;
        }

        // Already requesting session
        if (this.#sessionRequest) {
            errorCallback?.(
                new Error_(
                    ErrorCode.INVALID_PARAMETER,
                    "Session request already in progress."
                )
            );
            return;
        }

        // No receivers available
        if (!this.#receiverDevices.size) {
            errorCallback?.(new Error_(ErrorCode.RECEIVER_UNAVAILABLE));
            return;
        }

        /**
         * Store session request for use in return message from
         * receiver selection.
         */
        this.#sessionRequest =
            newSessionRequest ?? this.#apiConfig.sessionRequest;

        this.#requestSessionSuccessCallback = successCallback;
        this.#requestSessionErrorCallback = errorCallback;

        /**
         * If a receiver was provided, skip the receiver selector
         * process.
         */
        if (receiverDevice) {
            if (
                receiverDevice?.id &&
                this.#receiverDevices.has(receiverDevice.id)
            ) {
                this.#sendSessionRequest(this.#sessionRequest, receiverDevice);
            }
        } else {
            // Open receiver selector UI
            sendMessageResponse({
                subject: "main:selectReceiver"
            });
        }
    }

    requestSessionById(_sessionId: string): void {
        logger.info("STUB :: cast.requestSessionById");
    }

    setCustomReceivers(
        _receivers: Receiver[],
        _successCallback?: SuccessCallback,
        _errorCallback?: ErrorCallback
    ): void {
        logger.info("STUB :: cast.setCustomReceivers");
    }

    setPageContext(_win: Window): void {
        logger.info("STUB :: cast.setPageContext");
    }

    setReceiverDisplayStatus(_sessionId: string): void {
        logger.info("STUB :: cast.setReceiverDisplayStatus");
    }

    unescape(escaped: string): string {
        return window.decodeURI(escaped);
    }

    addReceiverActionListener(listener: ReceiverActionListener) {
        this.#receiverActionListeners.add(listener);
    }
    removeReceiverActionListener(listener: ReceiverActionListener) {
        this.#receiverActionListeners.delete(listener);
    }

    logMessage(message: string) {
        logger.info("cast.logMessage", message);
    }

    precache(_data: string) {
        logger.info("STUB :: cast.precache");
    }
}
