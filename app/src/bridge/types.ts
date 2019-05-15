"use strict";

export interface Message {
    subject: string;
    data?: any;
    _id?: string;
}

export type SendMessageCallback = (message: Message) => void;
