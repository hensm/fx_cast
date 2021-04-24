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
    receiver: Receiver;
    mediaType: ReceiverSelectorMediaType;
    filePath?: string;
}

export interface ReceiverSelectionStop {
    actionType: ReceiverSelectionActionType.Stop;
    receiver: Receiver;
}

export interface Receiver {
    host: string;
    friendlyName: string;
    id: string;
    port: number;
    status?: ReceiverStatus;
}
