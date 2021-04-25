"use strict";

import { Receiver
       , ReceiverSelectionCast
       , ReceiverSelectionStop
       , ReceiverStatus } from "./types";


type MessageDefinitions = {
    // Session messages
    "shim:session/stopped": {}
  , "shim:session/connected": {
        sessionId: string
      , namespaces: Array<{ name: string }>
      , displayName: string
      , statusText: string
    }
  , "shim:session/updateStatus": { volume: any /* Volume */ }
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
      , media: unknown // MediaInfo
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

        
export type Message = NarrowedMessage<Messages[keyof Messages]>;
