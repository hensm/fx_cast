"use strict";

import { Volume } from "./shim/cast/dataClasses";

import { LoadRequest, QueueInsertItemsRequest, QueueJumpRequest
       , QueueLoadRequest, QueueRemoveItemsRequest, QueueReorderItemsRequest
       , QueueSetPropertiesRequest, QueueUpdateItemsRequest } from "./shim/cast/media";


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
        { type: "PLAY", customData: (any | null) }
      | { type: "PAUSE", customData: (any | null) }
      | { type: "SEEK", customData: (any | null) }
      | { type: "STOP", customData: (any | null) }
      | { type: "MEDIA_GET_STATUS", customData: (any | null) }
      | { type: "SET_PLAYBACK_RATE", playbackRate: number }
      | {
            type: "MEDIA_SET_VOLUME"
          , volume: Partial<Volume>
          , customData: (any | null)
        }
      | {
            type: "EDIT_TRACKS_INFO"
          , requestId: number
          , activeTrackIds?: (number[] | null)
          , textTrackStyle?: (string | null)
        }
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
