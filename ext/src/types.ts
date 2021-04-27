"use strict";

import { Volume } from "./shim/cast/dataClasses";


export interface Receiver {
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
  , isActiveInput: boolean
  , isStandBy: boolean
  , userEq: unknown
  , volume: Volume
}
