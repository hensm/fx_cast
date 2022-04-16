"use strict";

import {
    Image,
    ReceiverStatus,
    SenderApplication,
    Volume
} from "./components/cast/types";

export interface ReceiverDevice {
    host: string;
    friendlyName: string;
    id: string;
    port: number;
    status?: ReceiverStatus;
}

export interface CastSessionUpdatedDetails {
    sessionId: string;
    statusText: string;
    namespaces: Array<{ name: string }>;
    volume: Volume;
}
export interface CastSessionCreatedDetails extends CastSessionUpdatedDetails {
    appId: string;
    appImages: Image[];
    displayName: string;
    receiverId: string;
    receiverFriendlyName: string;
    senderApps: SenderApplication[];
    transportId: string;
}
