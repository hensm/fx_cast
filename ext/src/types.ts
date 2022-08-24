"use strict";

import { SessionRequest } from "./cast/sdk/classes";
import { MediaStatus, ReceiverStatus } from "./cast/sdk/types";

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
    Screen = 4,
    File = 8
}
export enum ReceiverSelectionActionType {
    Cast = 1,
    Stop = 2
}

/** Info about sender page context. */
export interface ReceiverSelectorPageInfo {
    url: string;
    tabId: number;
    frameId: number;
    sessionRequest?: SessionRequest;
}
