"use strict";

import logger from "../../lib/logger";

import type { Message } from "../../messaging";
import eventMessaging from "../eventMessaging";

import type { ErrorCallback, SuccessCallback } from "../types";

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

type ReceiverActionListener = (
    receiver: Receiver,
    receiverAction: string
) => void;

type RequestSessionSuccessCallback = (session: Session) => void;

/** Cast SDK root class */
export default class {
    #apiConfig?: ApiConfig;
    #sessionRequest?: SessionRequest;

    #requestSessionSuccessCallback?: RequestSessionSuccessCallback;
    #requestSessionErrorCallback?: ErrorCallback;

    #initializeSuccessCallback?: SuccessCallback;

    #sessions = new Map<string, Session>();
    #receiverActionListeners = new Set<ReceiverActionListener>();

    #receiverAvailability = ReceiverAvailability.UNAVAILABLE;

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
        eventMessaging.page.addListener(this.#onMessage.bind(this));
    }

    #onMessage(message: Message) {
        switch (message.subject) {
            case "cast:initialized":
                this.#initializeSuccessCallback?.();
                this.#apiConfig?.receiverListener(this.#receiverAvailability);

                this.isAvailable = true;

                break;

            /**
             * Once the bridge detects a session creation, session info
             * and data needed to create cast API objects is sent.
             */
            case "cast:sessionCreated": {
                const status = message.data;

                status.receiver.volume = status.volume;
                status.receiver.displayStatus = new ReceiverDisplayStatus(
                    status.statusText,
                    status.appImages
                );

                const session = new Session(
                    status.sessionId,
                    status.appId,
                    status.displayName,
                    status.appImages,
                    status.receiver
                );

                session.namespaces = status.namespaces;
                session.senderApps = status.senderApps;
                session.statusText = status.statusText;
                session.transportId = status.transportId;

                this.#sessions.set(session.sessionId, session);

                /**
                 * If session created via requestSession, the success
                 * callback will be set, otherwise the session was
                 * created by the extension and the session listener
                 * should be called instead.
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

            case "cast:sessionUpdated": {
                const status = message.data;
                const session = this.#sessions.get(status.sessionId);
                if (!session) {
                    logger.error(`Session not found (${status.sessionId})`);
                    break;
                }

                session.statusText = status.statusText;
                session.namespaces = status.namespaces;
                session.receiver.volume = status.volume;

                for (const listener of session._updateListeners) {
                    listener(session.status !== SessionStatus.STOPPED);
                }

                break;
            }

            case "cast:sessionStopped": {
                const { sessionId } = message.data;
                const session = this.#sessions.get(sessionId);
                if (session) {
                    session.status = SessionStatus.STOPPED;
                    for (const listener of session._updateListeners) {
                        listener(false);
                    }
                }

                break;
            }

            case "cast:receivedSessionMessage": {
                const { sessionId, namespace, messageData } = message.data;
                const session = this.#sessions.get(sessionId);
                if (session) {
                    const listeners = session._messageListeners.get(namespace);
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

            case "cast:updateReceiverAvailability": {
                const availability = message.data.isAvailable
                    ? ReceiverAvailability.AVAILABLE
                    : ReceiverAvailability.UNAVAILABLE;

                // If availability has changed, call receiver listeners
                if (availability !== this.#receiverAvailability) {
                    this.#receiverAvailability = availability;
                    this.#apiConfig?.receiverListener(availability);
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

            case "cast:sendReceiverAction": {
                for (const actionListener of this.#receiverActionListeners) {
                    actionListener(message.data.receiver, message.data.action);
                }

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

        if (successCallback) {
            this.#initializeSuccessCallback = successCallback;
        }

        eventMessaging.page.sendMessage({
            subject: "main:initializeCast",
            data: { apiConfig: this.#apiConfig }
        });
    }

    requestSession(
        successCallback: RequestSessionSuccessCallback,
        errorCallback: ErrorCallback,
        newSessionRequest?: SessionRequest
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

        if (this.#receiverAvailability === ReceiverAvailability.UNAVAILABLE) {
            errorCallback?.(new Error_(ErrorCode.RECEIVER_UNAVAILABLE));
            return;
        }

        // Store used session request
        this.#sessionRequest =
            newSessionRequest ?? this.#apiConfig.sessionRequest;

        this.#requestSessionSuccessCallback = successCallback;
        this.#requestSessionErrorCallback = errorCallback;

        // Open receiver selector UI
        eventMessaging.page.sendMessage({
            subject: "main:selectReceiver",
            data: { sessionRequest: this.#sessionRequest }
        });
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
