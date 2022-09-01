"use strict";

import type { SessionRequest } from "./cast/sdk/classes";
import type { MediaStatus, ReceiverStatus } from "./cast/sdk/types";

export enum ReceiverDeviceCapabilities {
    NONE = 0,
    VIDEO_OUT = 1,
    VIDEO_IN = 2,
    AUDIO_OUT = 4,
    AUDIO_IN = 8,
    MULTIZONE_GROUP = 32
}

export interface ReceiverDevice {
    id: string;
    friendlyName: string;
    modelName: string;
    capabilities: ReceiverDeviceCapabilities;
    host: string;
    port: number;
    status?: ReceiverStatus;
    mediaStatus?: MediaStatus;
}

export enum ReceiverSelectorMediaType {
    None = 0,
    App = 1,
    Tab = 2,
    Screen = 4
}

export interface ReceiverSelectorAppInfo {
    sessionRequest: SessionRequest;
    isRequestAppAudioCompatible?: boolean;
}

/** Info about sender page context. */
export interface ReceiverSelectorPageInfo {
    url: string;
    tabId: number;
    frameId: number;
}
