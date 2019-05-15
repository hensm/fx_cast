"use strict";

export interface ReceiverStatus {
    volume: {
        muted: boolean;
        stepInterval: number;
        controlType: string;
        level: number;
    };
    applications?: Array<{
        displayName: string;
        statusText: string;
        transportId: string;
        isIdleScreen: boolean;
        sessionId: string;
        namespaces: Array<{ name: string }>;
        appId: string;
    }>;
    userEq?: {};
}

export interface MediaStatus {
    mediaSessionId: number;
    supportedMediaCommands: number;
    currentTime: number;
    media: {
        duration: number;
        contentId: string;
        streamType: string;
        contentType: string;
    };
    playbackRate: number;
    volume: {
        muted: boolean;
        level: number;
    };
    currentItemId: number;
    idleReason: string;
    playerState: string;
    extendedStatus: {
        playerState: string;
        media: {
            contentId: string;
            streamType: string;
            contentType: string;
            metadata: {
                images: Array<{ url: string }>;
                metadataType: number;
                artist: string;
                title: string;
            };
        }
    };
}
