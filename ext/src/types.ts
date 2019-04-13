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

export interface DownloadDelta {
    id: number;
    url?: browser.downloads.StringDelta;
    filename?: browser.downloads.StringDelta;
    danger?: browser.downloads.StringDelta;
    mime?: browser.downloads.StringDelta;
    startTime?: browser.downloads.StringDelta;
    endTime?: browser.downloads.StringDelta;
    state?: browser.downloads.StringDelta;
    canResume?: browser.downloads.BooleanDelta;
    paused?: browser.downloads.BooleanDelta;
    error?: browser.downloads.StringDelta;
    totalBytes?: browser.downloads.DoubleDelta;
    fileSize?: browser.downloads.DoubleDelta;
    exists?: browser.downloads.BooleanDelta;
}
