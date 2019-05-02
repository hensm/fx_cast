"use strict";

import { Message, Receiver, ReceiverStatus } from "./types";


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
    data: Receiver;
}

export interface NativeReceiverSelectorCloseMessage extends Message {
    subject: "main:/receiverSelector/error";
    data: string;
}

export interface NativeReceiverSelectorErrorMessage extends Message {
    subject: "main:/receiverSelector/error";
    data: string;
}
