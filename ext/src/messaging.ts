"use strict";

import Messenger from "./lib/Messenger";
import { TypedPort } from "./lib/TypedPort";

import { BridgeInfo } from "./lib/bridge";
import { Receiver, ReceiverStatus } from "./types";
import { ReceiverSelectorMediaType } from "./background/receiverSelector";
import { ReceiverSelection , ReceiverSelectionCast , ReceiverSelectionStop }
        from "./background/receiverSelector/ReceiverSelector";

import Volume from "./shim/cast/classes/Volume";
import { MediaInfo } from "./shim/cast/media";


type MessagesBase = {
    "popup:/close": {}
    "popup:/sendRequestedAppId": { requestedAppId?: string; }
    "popup:/populateReceiverList": {
        receivers: Receiver[];
        defaultMediaType?: ReceiverSelectorMediaType;
        availableMediaTypes?: ReceiverSelectorMediaType;
    }

    "receiverSelector:/selected": ReceiverSelection
    "receiverSelector:/stop": ReceiverSelection

    "main:/shimInitialized": { appId: string; }

    "main:/selectReceiverBegin": {}
    "shim:/selectReceiverEnd": ReceiverSelectionCast
    "shim:/selectReceiverStop": ReceiverSelectionStop
    "shim:/selectReceiverCancelled": {}

    "main:/sessionCreated": {}

    "shim:/serviceUp": { id: Receiver["id"] }
    "shim:/serviceDown": { id: Receiver["id"] }
    "shim:/initialized": BridgeInfo
    "shim:/launchApp": { receiver: Receiver }

    "shim:/session/stopped": {}
    "shim:/session/connected": {
        sessionId: string;
        namespaces: { name: string }[];
        displayName: string;
        statusText: string;
    }
    "shim:/session/updateStatus": { volume: Volume }
    "shim:/session/impl_addMessageListener": {
        namespace: string;
        data: string;
    }
    "shim:/session/impl_sendMessage": {
        messageId: string;
        error: boolean;
    }
    "shim:/session/impl_setReceiverMuted": {
        volumeId: string;
        error: boolean;
    }
    "shim:/session/impl_setReceiverVolumeLevel": {
        volumeId: string;
        error: boolean;
    }
    "shim:/session/impl_stop": {
        stopId: string;
        error: boolean;
    }

    "bridge:/session/initialize": {
        internalSessionId: string;
        sessionId: string;
        address: string;
        port: number;
        appId: string;
    }
    "bridge:/session/impl_leave": {
        internalSessionId: string;
        id: string;
    }
    "bridge:/session/impl_sendMessage": {
        internalSessionId: string;
        namespace: string;
        message: any;
        messageId: string
    }
    "bridge:/session/impl_setReceiverMuted": {
        internalSessionId: string;
        muted: boolean;
        volumeId: string;
    }
    "bridge:/session/impl_setReceiverVolumeLevel": {
        internalSessionId: string;
        newLevel: number;
        volumeId: string;
    }
    "bridge:/session/impl_stop": {
        internalSessionId: string;
        stopId: string;
    }
    "bridge:/session/impl_addMessageListener": {
        internalSessionId: string;
        namespace: string;
    }

    "shim:/media/update": {
        currentTime: number;
        _lastCurrentTime: number;
        customData: any;
        playbackRate: number;
        playerState: string;
        repeatMode: string;
        _volumeLevel: number;
        _volumeMuted: boolean;
        media: MediaInfo;
        mediaSessionId: number;
    }
    "shim:/media/sendMediaMessageResponse": {
        messageId: string;
        error: boolean
    }

    "bridge:/media/initialize": {
        sessionId: string;
        mediaSessionId: number;
        internalMediaSessionId: string;
        _internalSessionId: string;
    }
    "bridge:/media/sendMediaMessage": {
        message: any;
        messageId: string;
        internalMediaSessionId: string;
    }
    "main:/receiverSelector/selected": ReceiverSelectionCast
    "main:/receiverSelector/error": string;
    "main:/receiverSelector/close": {}
    "main:/receiverSelector/stop": ReceiverSelectionStop

    "bridge:/initialize": {
        shouldWatchStatus: boolean;
    }
    "bridge:/receiverSelector/open": any
    "bridge:/receiverSelector/close": {}
    "bridge:/stopReceiverApp": {
        receiver: Receiver
    }
    "bridge:/mediaServer/start": {
        filePath: string;
        port: number;
    }
    "mediaCast:/mediaServer/started": {
        mediaPath: string;
        subtitlePaths: string[];
        localAddress: string;
    }
    "mediaCast:/mediaServer/stopped": {}
    "mediaCast:/mediaServer/error": {}

    "main:/serviceUp": Receiver
    "main:/serviceDown": { id: string }
    "main:/receiverStatus": {
        id: string;
        status: ReceiverStatus;
    }
}


interface MessageBase<K extends keyof MessagesBase> {
    subject: K;
    data: MessagesBase[K];
}

type Messages = {
    [K in keyof MessagesBase]: MessageBase<K>
}

export type Message = Messages[keyof Messages];
export type Port = TypedPort<Messages>;

export default new Messenger<Messages>();
