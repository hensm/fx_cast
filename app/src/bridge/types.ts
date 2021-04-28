"use strict";

export interface ReceiverStatus {
    applications?: Array<{
        appId: string
      , appType: string
      , displayName: string
      , iconUrl: string
      , isIdleScreen: boolean
      , launchedFromCloud: boolean
      , namespaces: Array<{ name: string }>
      , sessionId: string
      , statusText: string
      , transportId: string
      , universalAppId: string
    }>
  , isActiveInput?: boolean
  , isStandBy?: boolean
  , userEq: unknown
  , volume: Volume
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

export enum ReceiverSelectorMediaType {
    App = 1
  , Tab = 2
  , Screen = 4
  , File = 8
}

export enum ReceiverSelectionActionType {
    Cast = 1
  , Stop = 2
}

export interface ReceiverSelectionCast {
    actionType: ReceiverSelectionActionType.Cast;
    receiver: ReceiverDevice;
    mediaType: ReceiverSelectorMediaType;
    filePath?: string;
}

export interface ReceiverSelectionStop {
    actionType: ReceiverSelectionActionType.Stop;
    receiver: ReceiverDevice;
}

export interface ReceiverDevice {
    host: string;
    friendlyName: string;
    id: string;
    port: number;
    status?: ReceiverStatus;
}


export enum VolumeControlType {
    ATTENUATION = "attenuation"
  , FIXED = "fixed"
  , MASTER = "master"
}


export class Volume {
    public controlType?: VolumeControlType;
    public stepInterval?: number;

    constructor(
            public level: (number | null) = null
          , public muted: (boolean | null) = null) {}
}


export type ReceiverMessage =
        { type: "LAUNCH", appId: string }
      | { type: "STOP", sessionId: string }
      | { type: "GET_STATUS" }
      | { type: "GET_APP_AVAILABILITY", appId: string[] }
      | {
            type: "SET_VOLUME"
          , volume: { level: number }
                  | { muted: boolean }
        };
