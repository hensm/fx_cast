import { Logger } from "../../lib/logger";

import type { Message } from "../../messaging";
import pageMessaging from "../pageMessaging";

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
    Error as CastError,
    Image,
    Receiver,
    ReceiverDisplayStatus,
    SenderApplication,
    SessionRequest,
    Timeout,
    Volume
} from "./classes";

import Session, {
    createSession,
    SessionLeaveSuccessCallback,
    SessionMessageListeners,
    SessionSendMessageCallbacks,
    SessionUpdateListeners
} from "./Session";

import * as media from "./media";

const logger = new Logger("fx_cast [sdk]");

type ReceiverActionListener = (
    receiver: Receiver,
    receiverAction: string
) => void;

type RequestSessionSuccessCallback = (session: Session) => void;

/** Cast SDK root class */
export default class {
    #apiConfig?: ApiConfig;
    #sessionRequest?: SessionRequest;

    #isInitialized = false;

    /** Current receiver availability. */
    #receiverAvailability?: ReceiverAvailability;

    #initializeSuccessCallback?: () => void;

    #requestSessionSuccessCallback?: RequestSessionSuccessCallback;
    #requestSessionErrorCallback?: (err: CastError) => void;

    #receiverActionListeners = new Set<ReceiverActionListener>();

    #sessions = new Map<string, Session>();

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
    Error = CastError;
    Image = Image;
    Receiver = Receiver;
    ReceiverDisplayStatus = ReceiverDisplayStatus;
    SenderApplication = SenderApplication;
    SessionRequest = SessionRequest;
    Timeout = Timeout;
    Volume = Volume;
    Session = Session;

    media = { ...media };

    VERSION = [1, 2];
    isAvailable = false;
    timeout = new Timeout();

    constructor() {
        pageMessaging.page.addListener(this.#onMessage.bind(this));
    }

    #onMessage(message: Message) {
        switch (message.subject) {
            case "cast:instanceCreated":
                this.isAvailable = true;
                break;

            case "cast:receiverAvailabilityUpdated": {
                /**
                 * The first availability update happens after
                 * initialize is called.
                 */
                if (!this.#isInitialized) {
                    this.#isInitialized = true;
                    this.#initializeSuccessCallback?.();
                }

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

            case "cast:receiverAction":
                for (const actionListener of this.#receiverActionListeners) {
                    actionListener(message.data.receiver, message.data.action);
                }
                break;

            // Popup closed before session established
            case "cast:sessionRequestCancelled":
                if (this.#sessionRequest) {
                    this.#sessionRequest = undefined;

                    this.#requestSessionErrorCallback?.(
                        new CastError(ErrorCode.CANCEL)
                    );
                }
                break;

            /**
             * Once the bridge detects a session creation, session info
             * and data needed to create cast API objects is sent.
             */
            case "cast:sessionCreated": {
                this.#sessionRequest = undefined;
                const status = message.data;

                status.receiver.volume = status.volume;
                status.receiver.displayStatus = new ReceiverDisplayStatus(
                    status.statusText,
                    status.appImages
                );

                const session = createSession([
                    status.sessionId,
                    status.appId,
                    status.displayName,
                    status.appImages,
                    status.receiver
                ]);

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

                const updateListeners = SessionUpdateListeners.get(session);
                if (updateListeners) {
                    for (const listener of updateListeners) {
                        listener(session.status !== SessionStatus.STOPPED);
                    }
                }

                break;
            }

            case "cast:sessionStopped": {
                const session = this.#sessions.get(message.data.sessionId);
                if (session?.status === SessionStatus.CONNECTED) {
                    session.status = SessionStatus.STOPPED;

                    const updateListeners = SessionUpdateListeners.get(session);
                    if (updateListeners) {
                        for (const listener of updateListeners) {
                            listener(false);
                        }
                    }
                }

                break;
            }

            case "cast:sessionDisconnected": {
                const session = this.#sessions.get(message.data.sessionId);
                if (session?.status === SessionStatus.CONNECTED) {
                    session.status = SessionStatus.DISCONNECTED;

                    SessionLeaveSuccessCallback.get(session)?.();

                    const updateListeners = SessionUpdateListeners.get(session);
                    if (updateListeners) {
                        for (const listener of updateListeners) {
                            listener(true);
                        }
                    }
                }

                break;
            }

            case "cast:sessionMessageReceived": {
                const { sessionId, namespace, messageData } = message.data;
                const session = this.#sessions.get(sessionId);
                if (session) {
                    const listeners =
                        SessionMessageListeners.get(session)?.get(namespace);
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

                const sendMessageCallback =
                    SessionSendMessageCallbacks.get(session)?.get(messageId);
                if (sendMessageCallback) {
                    const [successCallback, errorCallback] =
                        sendMessageCallback;

                    if (error) {
                        errorCallback?.(
                            new CastError(ErrorCode.CHANNEL_ERROR, error)
                        );
                        return;
                    }

                    successCallback?.();
                }

                break;
            }
        }
    }

    initialize(
        apiConfig: ApiConfig,
        successCallback?: () => void,
        errorCallback?: (err: CastError) => void
    ) {
        logger.info("cast.initialize");

        // Already initialized
        if (this.#apiConfig) {
            errorCallback?.(new CastError(ErrorCode.INVALID_PARAMETER));
            return;
        }

        this.#apiConfig = apiConfig;

        if (successCallback) {
            this.#initializeSuccessCallback = successCallback;
        }

        pageMessaging.page.sendMessage({
            subject: "main:initializeCastSdk",
            data: { apiConfig: this.#apiConfig }
        });
    }

    requestSession(
        successCallback: RequestSessionSuccessCallback,
        errorCallback: (err: CastError) => void,
        newSessionRequest?: SessionRequest
    ) {
        logger.info("cast.requestSession");

        // Not yet initialized
        if (!this.#apiConfig) {
            errorCallback?.(new CastError(ErrorCode.API_NOT_INITIALIZED));
            return;
        }

        // Already requesting session
        if (this.#sessionRequest) {
            errorCallback?.(
                new CastError(
                    ErrorCode.INVALID_PARAMETER,
                    "Session request already in progress."
                )
            );
            return;
        }

        if (this.#receiverAvailability === ReceiverAvailability.UNAVAILABLE) {
            errorCallback?.(new CastError(ErrorCode.RECEIVER_UNAVAILABLE));
            return;
        }

        // Store used session request
        this.#sessionRequest =
            newSessionRequest ?? this.#apiConfig.sessionRequest;

        this.#requestSessionSuccessCallback = successCallback;
        this.#requestSessionErrorCallback = errorCallback;

        // Open receiver selector UI
        pageMessaging.page.sendMessage({
            subject: "main:requestSession",
            data: { sessionRequest: this.#sessionRequest }
        });
    }

    requestSessionById(sessionId: string) {
        pageMessaging.page.sendMessage({
            subject: "main:requestSessionById",
            data: { sessionId }
        });
    }

    setCustomReceivers(
        _receivers: Receiver[],
        _successCallback?: () => void,
        _errorCallback?: (err: CastError) => void
    ) {
        logger.info("STUB :: cast.setCustomReceivers");
    }

    setPageContext(_win: Window) {
        logger.info("STUB :: cast.setPageContext");
    }

    setReceiverDisplayStatus(_sessionId: string) {
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
        logger.info("(logMessage)", message);
    }

    precache(_data: string) {
        logger.info("STUB :: cast.precache");
    }
}
