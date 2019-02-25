"use strict";

export interface Message {
    subject: string;
    data: any;
    _id?: string;
}

export interface SendMessageCallback {
    (message: Message): void
}
