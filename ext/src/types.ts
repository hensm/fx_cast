"use strict";

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
