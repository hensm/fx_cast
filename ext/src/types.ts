"use strict";

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
        isIdleScreen: boolean;
        statusText: string;
    };
    volume: {
        level: number;
        muted: boolean
    };
}
