"use strict";

import { ReceiverSelection } from "./receiver_selectors/ReceiverSelector";


export interface Message {
    subject: string;
    data?: any;
    _id?: string;
}

export interface Receiver {
    host: string;
    friendlyName: string;
    id: string;
    port: number;
    status?: ReceiverStatus;
}

export interface ReceiverStatus {
    application: {
        displayName: string;
        isIdleScreen: string;
        statusText: string;
    };
    id: string;
    volume: {
        level: number;
        muted: boolean
    };
}


export interface ReceiverStatusMessage extends Message {
    subject: "receiverStatus";
    data: {
        id: string;
        status: ReceiverStatus;
    };
}

export interface ServiceDownMessage extends Message {
    subject: "shim:/serviceDown";
    data: {
        id: string;
    };
}

export interface ServiceUpMessage extends Message {
    subject: "shim:/serviceUp";
    data: Receiver;
}


export interface NativeReceiverSelectorSelectedMessage extends Message {
    subject: "main:/receiverSelector/selected";
    data: ReceiverSelection;
}

export interface NativeReceiverSelectorCloseMessage extends Message {
    subject: "main:/receiverSelector/error";
    data: string;
}

export interface NativeReceiverSelectorErrorMessage extends Message {
    subject: "main:/receiverSelector/error";
    data: string;
}
