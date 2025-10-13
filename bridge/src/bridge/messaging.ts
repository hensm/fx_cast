import { TypedEmitter } from "tiny-typed-emitter";

import { DecodeTransform, EncodeTransform } from "../transforms";

import type {
    MediaStatus,
    ReceiverStatus,
    SenderMediaMessage,
    SenderMessage
} from "./components/cast/types";

import type {
    ReceiverDevice,
    CastSessionCreatedDetails,
    CastSessionUpdatedDetails
} from "./messagingTypes";
import type { WebSocket } from "ws";

/**
 * IMPORTANT:
 * Messages that cross the native messaging channel. MUST keep
 * in-sync with the extension's version at:
 *   extension/src/messaging.ts > AppMessageDefinitions
 */
type MessageDefinitions = {
    /**
     * First message sent by the extension to the bridge.
     * Includes extension version string. Responds directly with version
     * string of the bridge to compare.
     *
     * Still uses `:/` message separator for compat talking to older
     * bridge versions.
     */
    "bridge:getInfo": string;
    "bridge:/getInfo": string;

    /**
     * Tells a bridge to begin service discovery (and whether to
     * establish connections to monitor the status of the receiver
     * devices).
     */
    "bridge:startDiscovery": {
        shouldWatchStatus: boolean;
    };

    /**
     * Sent to extension from the bridge whenever a receiver device is
     * found.
     */
    "main:deviceUp": { deviceId: string; deviceInfo: ReceiverDevice };
    /**
     * Sent to extension from the bridge whenever a previously found
     * receiver device is lost.
     */
    "main:deviceDown": { deviceId: string };

    /**
     * Sent to the extension from the bridge whenever a
     * `RECEIVER_STATUS` message (`NS_RECEIVER`) is received.
     */
    "main:receiverDeviceStatusUpdated": {
        deviceId: string;
        status: ReceiverStatus;
    };
    /**
     * Sent to the extension from the bridge whenever a
     * `MEDIA_STATUS` message (`NS_RECEIVER`) is received.
     */
    "main:receiverDeviceMediaStatusUpdated": {
        deviceId: string;
        status: MediaStatus;
    };

    /**
     * Sent to the bridge when non-session related receiver messages
     * need to be sent (e.g. volume control, application stop, etc...).
     */
    "bridge:sendReceiverMessage": {
        deviceId: string;
        message: SenderMessage;
    };
    /**
     * Sent to the bridge when the receiver selector media UI is used
     * to control media playback.
     */
    "bridge:sendMediaMessage": {
        deviceId: string;
        message: SenderMediaMessage;
    };

    /**
     * Sent to bridge from cast API instance when a session request is
     * initiated.
     */
    "bridge:createCastSession": {
        appId: string;
        receiverDevice: ReceiverDevice;
    };
    /**
     * Connects to, and sends a `STOP` message on the `NS_RECEIVER`
     * channel for the given receiver device.
     */
    "bridge:stopCastSession": {
        receiverDevice: ReceiverDevice;
    };

    /**
     * Sent to cast API instances whenever a session is created or
     * updates. Updated details is a mutable subset of session details
     * otherwise fixed on creation.
     */
    "main:castSessionCreated": CastSessionCreatedDetails;
    "main:castSessionUpdated": CastSessionUpdatedDetails;
    /**
     * Sent to cast API instances whenever a session is stopped.
     */
    "cast:sessionStopped": {
        sessionId: string;
    };

    /**
     * Sent to bridge from cast API instance whenever an `NS_RECEIVER`
     * message needs to be sent.
     */
    "bridge:sendCastReceiverMessage": {
        sessionId: string;
        messageData: SenderMessage;
        messageId: string;
    };

    /**
     * Sent to bridge from cast API instance whenever a application
     * session message needs to be sent (via
     * `chrome.cast.Session#sendMessage`).
     */
    "bridge:sendCastSessionMessage": {
        sessionId: string;
        namespace: string;
        messageData: object | string;
        messageId: string;
    };
    /**
     * Sent to cast API instance from bridge when session message
     * received from a receiver device.
     */
    "cast:sessionMessageReceived": {
        sessionId: string;
        namespace: string;
        messageData: string;
    };

    /**
     * Sent to cast API instance from bridge whenever a message
     * operation is completed. If an error ocurred, an error string will
     * be passed as the `error` data property.
     */
    "cast:impl_sendMessage": {
        sessionId: string;
        messageId: string;
        error?: string;
    };

    /**
     * Sent to the bridge to start an HTTP media server at a given file
     * path on the given port.
     */
    "bridge:startMediaServer": {
        filePath: string;
        port: number;
    };
    /**
     * Sent to media sender from bridge when the media server is ready
     * to serve files.
     */
    "mediaCast:mediaServerStarted": {
        mediaPath: string;
        subtitlePaths: string[];
        localAddress: string;
    };
    /**
     * Sent to bridge to stop HTTP media server.
     */
    "bridge:stopMediaServer": undefined;
    /**
     * Sent to media sender from bridge when the media server has
     * stopped.
     */
    "mediaCast:mediaServerStopped": undefined;
    /**
     * Sent to media sender from bridge when the media server has
     * encountered an error.
     */
    "mediaCast:mediaServerError": string;
};

interface MessageBase<K extends keyof MessageDefinitions> {
    subject: K;
    data: MessageDefinitions[K];
}

type Messages = {
    [K in keyof MessageDefinitions]: MessageBase<K>;
};

/**
 * Make message data key optional if specified as blank or with
 * all-optional keys.
 */
type NarrowedMessage<L extends MessageBase<keyof MessageDefinitions>> =
    L extends unknown
        ? undefined extends L["data"]
            ? Omit<L, "data"> & Partial<L>
            : L
        : never;

export type Message = NarrowedMessage<Messages[keyof Messages]>;

interface MessengerEvents {
    message: (message: Message) => void;
}

export abstract class Messenger extends TypedEmitter<MessengerEvents> {
    abstract sendMessage(message: Message): void;
    abstract send(data: unknown): void;
}

export class StdioMessenger
    extends TypedEmitter<MessengerEvents>
    implements Messenger
{
    // Native messaging transforms
    private decodeTransform = new DecodeTransform();
    private encodeTransform = new EncodeTransform();

    constructor() {
        super();

        // Hook up stdin -> stdout
        process.stdin.pipe(this.decodeTransform);
        this.encodeTransform.pipe(process.stdout);

        this.decodeTransform.on("error", err =>
            console.error("err (message decode):", err)
        );
        this.encodeTransform.on("error", err =>
            console.error("err (message encode):", err)
        );

        this.decodeTransform.on("data", (message: Message) => {
            this.emit("message", message);
        });
    }

    /** Sends a message to the extension. */
    sendMessage(message: Message) {
        this.send(message);
    }

    send(data: unknown) {
        this.encodeTransform.write(data);
    }
}

export class WebsocketMessenger
    extends TypedEmitter<MessengerEvents>
    implements Messenger
{
    private socket: WebSocket;

    constructor(socket: WebSocket) {
        super();

        this.socket = socket;
        socket.on("message", (message: string) => {
            try {
                const parsed = JSON.parse(message) as Message;
                this.emit("message", parsed);
            } catch (err) {
                // Catch parse errors and close socket
                socket.close();
            }
        });
    }

    /** Sends a message to the extension. */
    sendMessage(message: Message) {
        this.send(message);
    }

    send(data: unknown) {
        this.socket.send(JSON.stringify(data));
    }
}
