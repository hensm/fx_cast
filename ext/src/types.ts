"use strict";

import { Volume } from "./shim/cast/dataClasses";

import { EditTracksInfoRequest, GetStatusRequest, LoadRequest, PauseRequest
       , PlayRequest, QueueInsertItemsRequest, QueueJumpRequest
       , QueueLoadRequest, QueueRemoveItemsRequest, QueueReorderItemsRequest
       , QueueSetPropertiesRequest, QueueUpdateItemsRequest, SeekRequest
       , StopRequest, VolumeRequest } from "./shim/cast/media";


export interface ReceiverDevice {
    host: string
    friendlyName: string
  , id: string
  , port: number
  , status?: ReceiverStatus
}

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


export type SessionMediaMessage =
        { type: "PLAY" } & PlayRequest
      | { type: "PAUSE" } & PauseRequest
      | { type: "SEEK" } & SeekRequest
      | { type: "STOP" } & StopRequest
      | { type: "MEDIA_GET_STATUS" } & GetStatusRequest
      | { type: "MEDIA_SET_VOLUME" } & VolumeRequest
      | { type: "EDIT_TRACKS_INFO" } & EditTracksInfoRequest
      | { type: "SET_PLAYBACK_RATE", playbackRate: number }
      | LoadRequest
      | QueueLoadRequest
      | QueueInsertItemsRequest
      | QueueUpdateItemsRequest
      | QueueJumpRequest
      | QueueRemoveItemsRequest
      | QueueReorderItemsRequest
      | QueueSetPropertiesRequest;

export type SessionReceiverMessage =
        { type: "LAUNCH", appId: string }
      | { type: "STOP", sessionId: string }
      | { type: "GET_STATUS" }
      | { type: "GET_APP_AVAILABILITY", appId: string[] }
      | { type: "SET_VOLUME", volume: Partial<Volume> };
