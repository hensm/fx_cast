"use strict";

import Messenger from "./lib/Messenger";

import { TypedPort } from "./lib/TypedPort";
import { BridgeInfo } from "./lib/bridge";

import { ReceiverSelectorMediaType } from "./background/receiverSelector";
import { ReceiverSelection
       , ReceiverSelectionCast
       , ReceiverSelectionStop }
        from "./background/receiverSelector/ReceiverSelector";

import { CastSessionCreated
       , CastSessionUpdated
       , ReceiverStatus
       , SenderMessage } from "./shim/cast/types";

import { ReceiverDevice } from "./types";


/**
 * Messages are JSON objects with a `subject` string key and a
 * generic `data` key:
 *   { subject: "...", data: ... }
 * 
 * Message subjects may include an optional destination and
 * response name formatted like this:
 *   ^(destination:)?messageName(\/responseName)?$
 * 
 * Message formats are specified with subject as a key and data
 * as the value in the message tables.
 */


/**
 * Messages exclusively used internally between extension
 * components.
 */
type ExtMessageDefinitions = {
    "popup:init": { appId?: string }
  , "popup:update": {
        receivers: ReceiverDevice[]
      , defaultMediaType?: ReceiverSelectorMediaType
      , availableMediaTypes?: ReceiverSelectorMediaType
    }
  , "popup:close": {}

  , "receiverSelector:selected": ReceiverSelection
  , "receiverSelector:stop": ReceiverSelection

  , "main:shimReady": { appId: string }

  , "main:selectReceiver": {}
  , "shim:selectReceiver/selected": ReceiverSelectionCast
  , "shim:selectReceiver/stopped": ReceiverSelectionStop
  , "shim:selectReceiver/cancelled": {}

  , "main:sessionCreated": {}

  , "shim:initialized": BridgeInfo
  , "shim:serviceUp": { receiverDevice: ReceiverDevice }
  , "shim:serviceDown": { receiverDeviceId: ReceiverDevice["id"] }

  , "shim:launchApp": { receiver: ReceiverDevice }
}

/**
 * Messages that cross the native messaging channel. MUST keep
 * in-sync with the bridge's version at:
 *   app/bridge/messaging.ts > MessagesBase
 */
type AppMessageDefinitions = {
    "shim:castSessionCreated": CastSessionCreated
  , "shim:castSessionUpdated": CastSessionUpdated
  , "shim:castSessionStopped": {
        sessionId: string
    }

  , "shim:receivedCastSessionMessage": {
        sessionId: string
      , namespace: string
      , messageData: string
    }

  , "shim:impl_sendCastMessage": {
        sessionId: string
      , messageId: string
      , error?: string
    }

  , "bridge:createCastSession": {
        appId: string
      , receiverDevice: ReceiverDevice
    }
  , "bridge:sendCastReceiverMessage": {
        sessionId: string
      , messageData: SenderMessage
      , messageId: string
    }
  , "bridge:sendCastSessionMessage": {
        sessionId: string
      , namespace: string
      , messageData: object | string
      , messageId: string
    }

  , "bridge:stopCastApp": { receiverDevice: ReceiverDevice }

    // Bridge messages
  , "main:receiverSelector/selected": ReceiverSelectionCast
  , "main:receiverSelector/stopped": ReceiverSelectionStop
  , "main:receiverSelector/cancelled": {}
  , "main:receiverSelector/error": string

    /**
     * getInfo uses the old :/ form for compat with old bridge
     * versions.
     */
  , "bridge:getInfo": string
  , "bridge:/getInfo": string

  , "bridge:startDiscovery": {
        shouldWatchStatus: boolean
    }

  , "bridge:openReceiverSelector": string
  , "bridge:closeReceiverSelector": {}

  , "bridge:startMediaServer": {
        filePath: string
      , port: number
    }
  , "bridge:stopMediaServer": {}

  , "mediaCast:mediaServerStarted": {
        mediaPath: string
      , subtitlePaths: string[]
      , localAddress: string
    }
  , "mediaCast:mediaServerStopped": {}
  , "mediaCast:mediaServerError": {}


  , "main:receiverDeviceUp": { receiverDevice: ReceiverDevice }
  , "main:receiverDeviceDown": { receiverDeviceId: string }
  , "main:receiverDeviceUpdated": {
        receiverDeviceId: string
      , status: ReceiverStatus
    }
}

type MessageDefinitions =
        ExtMessageDefinitions
      & AppMessageDefinitions;


interface MessageBase<K extends keyof MessageDefinitions> {
    subject: K;
    data: MessageDefinitions[K];
}

type Messages = {
    [K in keyof MessageDefinitions]: MessageBase<K>;
}

/**
 * For better call semantics, make message data key optional if
 * specified as blank or with all-optional keys.
 */
type NarrowedMessage<L extends MessageBase<keyof MessageDefinitions>> =
    L extends any
        ? {} extends L["data"]
            ? Omit<L, "data"> & Partial<L>
            : L
        : never;

        
export type Port = TypedPort<Message>;
export type Message = NarrowedMessage<Messages[keyof Messages]>;


export default new Messenger<Message>();
