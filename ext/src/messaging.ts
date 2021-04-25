"use strict";

import Messenger from "./lib/Messenger";
import { TypedPort } from "./lib/TypedPort";

import { BridgeInfo } from "./lib/bridge";
import { Receiver, ReceiverStatus } from "./types";
import { ReceiverSelectorMediaType } from "./background/receiverSelector";
import { ReceiverSelection, ReceiverSelectionCast, ReceiverSelectionStop }
    from "./background/receiverSelector/ReceiverSelector";

import Volume from "./shim/cast/classes/Volume";
import { MediaInfo } from "./shim/cast/media";


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
        receivers: Receiver[]
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
  , "shim:serviceUp": { id: Receiver["id"] }
  , "shim:serviceDown": { id: Receiver["id"] }

  , "shim:launchApp": { receiver: Receiver }
}

/**
 * Messages that cross the native messaging channel. MUST keep
 * in-sync with the bridge's version at:
 *   app/bridge/messaging.ts > MessagesBase
 */
type AppMessageDefinitions = {
    // Session messages
    "shim:session/stopped": {}
  , "shim:session/connected": {
        sessionId: string
      , namespaces: Array<{ name: string }>
      , displayName: string
      , statusText: string
    }
  , "shim:session/updateStatus": { volume: Volume }
  , "shim:session/impl_addMessageListener": {
        namespace: string
      , data: string
    }
  , "shim:session/impl_sendMessage": {
        messageId: string
      , error: boolean
    }
  , "shim:session/impl_setReceiverMuted": {
        volumeId: string
      , error: boolean
    }
  , "shim:session/impl_setReceiverVolumeLevel": {
        volumeId: string
      , error: boolean
    }
  , "shim:session/impl_stop": {
        stopId: string
      , error: boolean
    }

    // Bridge session messages
  , "bridge:session/initialize": {
        address: string
      , port: number
      , appId: string
      , sessionId: string
      , _id: string
    }
  , "bridge:session/close": {}
  , "bridge:session/impl_leave": {
        id: string
      , _id: string
    }
  , "bridge:session/impl_sendMessage": {
        namespace: string
      , message: any
      , messageId: string
      , _id: string
    }
  , "bridge:session/impl_setReceiverMuted": {
        muted: boolean
      , volumeId: string
      , _id: string
    }
  , "bridge:session/impl_setReceiverVolumeLevel": {
        newLevel: number
      , volumeId: string
      , _id: string
    }
  , "bridge:session/impl_stop": {
        stopId: string;
        _id: string;
    }
  , "bridge:session/impl_addMessageListener": {
        namespace: string;
        _id: string;
    }

    // Media messages
  , "shim:media/update": {
        currentTime: number
      , _lastCurrentTime: number
      , customData: any
      , playbackRate: number
      , playerState: string
      , repeatMode: string
      , _volumeLevel: number
      , _volumeMuted: boolean
      , media: MediaInfo
      , mediaSessionId: number
    }
  , "shim:media/sendMediaMessageResponse": {
        messageId: string
      , error: boolean
    }

    // Bridge media messages
  , "bridge:media/initialize": {
        sessionId: string
      , mediaSessionId: number
      , _internalSessionId: string
      , _id: string
    }
  , "bridge:media/sendMediaMessage": {
        message: any
      , messageId: string
      , _id: string
    }

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

  , "bridge:initialize": {
        shouldWatchStatus: boolean
    }

  , "bridge:openReceiverSelector": string
  , "bridge:closeReceiverSelector": {}

  , "bridge:stopReceiverApp": { receiver: Receiver }


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


  , "main:serviceUp": Receiver
  , "main:serviceDown": { id: string }

  , "main:receiverStatus": {
        id: string
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
