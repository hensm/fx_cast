"use strict";

import {
    Image,
    MediaStatus,
    ReceiverStatus,
    SenderApplication,
    SenderMessage,
    Volume
} from "./components/cast/types";

import { ReceiverDevice } from "./types";

interface CastSessionUpdated {
    sessionId: string;
    statusText: string;
    namespaces: Array<{ name: string }>;
    volume: Volume;
}

interface CastSessionCreated extends CastSessionUpdated {
    appId: string;
    appImages: Image[];
    displayName: string;
    receiverFriendlyName: string;
    senderApps: SenderApplication[];
    transportId: string;
}

/**
 * Messages that cross the native messaging channel. MUST keep
 * in-sync with the extension's version at:
 *   ext/src/messaging.ts > MessageDefinitions
 */
type MessageDefinitions = {
    "cast:sessionCreated": CastSessionCreated;
    "cast:sessionUpdated": CastSessionUpdated;
    "cast:sessionStopped": {
        sessionId: string;
    };
    "cast:receivedSessionMessage": {
        sessionId: string;
        namespace: string;
        messageData: string;
    };
    "cast:impl_sendMessage": {
        sessionId: string;
        messageId: string;
        error?: string;
    };
    "bridge:createCastSession": {
        appId: string;
        receiverDevice: ReceiverDevice;
    };
    "bridge:sendCastReceiverMessage": {
        sessionId: string;
        messageData: SenderMessage;
        messageId: string;
    };
    "bridge:sendCastSessionMessage": {
        sessionId: string;
        namespace: string;
        messageData: object | string;
        messageId: string;
    };
    "bridge:stopCastSession": {
        receiverDevice: ReceiverDevice;
    };

    /**
     * getInfo uses the old :/ form for compat with old bridge
     * versions.
     */
    "bridge:getInfo": string;
    "bridge:/getInfo": string;

    "bridge:startDiscovery": {
        shouldWatchStatus: boolean;
    };

    "bridge:startMediaServer": {
        filePath: string;
        port: number;
    };
    "bridge:stopMediaServer": {};
    "mediaCast:mediaServerStarted": {
        mediaPath: string;
        subtitlePaths: string[];
        localAddress: string;
    };
    "mediaCast:mediaServerStopped": {};
    "mediaCast:mediaServerError": {};

    "main:receiverDeviceUp": { deviceId: string; deviceInfo: ReceiverDevice };
    "main:receiverDeviceDown": { deviceId: string };
    "main:receiverDeviceStatusUpdated": {
        deviceId: string;
        status: ReceiverStatus;
    };
    "main:receiverDeviceMediaStatusUpdated": {
        deviceId: string;
        status: MediaStatus;
    };
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
    L extends any
        ? {} extends L["data"]
            ? Omit<L, "data"> & Partial<L>
            : L
        : never;

export type Message = NarrowedMessage<Messages[keyof Messages]>;
