"use strict";

export interface Message {
    subject: string;
    data: any;
}

export interface Receiver {
    friendlyName: string;
    address: string;
    port: number;
    currentApp: string;
}
