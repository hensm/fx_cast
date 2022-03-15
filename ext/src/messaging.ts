"use strict";

import { TypedPort } from "./lib/TypedPort";
import { BridgeInfo } from "./lib/bridge";

import { ReceiverSelectorMediaType } from "./background/receiverSelector";
import {
    ReceiverSelection,
    ReceiverSelectionCast,
    ReceiverSelectionStop
} from "./background/receiverSelector";

import {
    CastSessionCreated,
    CastSessionUpdated,
    MediaStatus,
    ReceiverStatus,
    SenderMessage
} from "./shim/cast/types";

import { ReceiverDevice } from "./types";

/**
 * Messages are JSON objects with a `subject` string key and a
 * generic `data` key:
 *   { subject: "...", data: ... }
 *
 * Message subjects may include an optional destination and
 * response name formatted like this:
 *   ^(destination:)?messageName(\/responseName)?$
 *
 * Message formats are specified with subject as a key and data
 * as the value in the message tables.
 */

/**
 * Messages exclusively used internally between extension
 * components.
 */
type ExtMessageDefinitions = {
    "popup:init": {
        appId?: string;
    };
    "popup:update": {
        receivers: ReceiverDevice[];
        defaultMediaType?: ReceiverSelectorMediaType;
        availableMediaTypes?: ReceiverSelectorMediaType;
    };
    "popup:close": {};
    "receiverSelector:selected": ReceiverSelection;
    "receiverSelector:stop": ReceiverSelection;
    "main:shimReady": { appId: string };
    "main:selectReceiver": {};
    "shim:selectReceiver/selected": ReceiverSelectionCast;
    "shim:selectReceiver/stopped": ReceiverSelectionStop;
    "shim:selectReceiver/cancelled": {};
    "main:sessionCreated": {};
    "shim:initialized": BridgeInfo;
    "shim:serviceUp": { receiverDevice: ReceiverDevice };
    "shim:serviceDown": { receiverDeviceId: ReceiverDevice["id"] };
    "shim:launchApp": { receiver: ReceiverDevice };
};

/**
 * Messages that cross the native messaging channel. MUST keep
 * in-sync with the bridge's version at:
 *   app/src/bridge/messaging.ts > MessageDefinitions
 */
type AppMessageDefinitions = {
    "shim:castSessionCreated": CastSessionCreated;
    "shim:castSessionUpdated": CastSessionUpdated;
    "shim:castSessionStopped": {
        sessionId: string;
    };
    "shim:receivedCastSessionMessage": {
        sessionId: string;
        namespace: string;
        messageData: string;
    };
    "shim:impl_sendCastMessage": {
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
    "bridge:stopCastApp": { receiverDevice: ReceiverDevice };

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

    // Device discovery
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

type MessageDefinitions = ExtMessageDefinitions & AppMessageDefinitions;

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

export type Port = TypedPort<Message>;
export type Message = NarrowedMessage<Messages[keyof Messages]>;

/**
 * Typed WebExtension-style messaging utility class.
 */
export default new (class Messenger {
    connect(connectInfo: { name: string }) {
        return browser.runtime.connect(connectInfo) as unknown as Port;
    }

    connectTab(tabId: number, connectInfo: { name: string; frameId: number }) {
        return browser.tabs.connect(tabId, connectInfo) as unknown as Port;
    }

    onConnect = {
        addListener(cb: (port: Port) => void) {
            browser.runtime.onConnect.addListener(cb as any);
        },
        removeListener(cb: (port: Port) => void) {
            browser.runtime.onConnect.removeListener(cb as any);
        },
        hasListener(cb: (port: Port) => void) {
            return browser.runtime.onConnect.hasListener(cb as any);
        }
    };
})();
