"use strict";

import { ReceiverStatus } from "./castTypes";

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

export type SendMessageCallback = (message: Message) => void;
