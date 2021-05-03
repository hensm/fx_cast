"use strict";

import { Image
       , ReceiverApplication
       , ReceiverStatus
       , SenderApplication
       , SenderMessage
       , Volume } from "./components/chromecast/types";

import { ReceiverDevice
       , ReceiverSelectionCast
       , ReceiverSelectionStop } from "./types";


interface CastSessionUpdated {
    sessionId: string
  , statusText: string
  , namespaces: Array<{ name: string }>
  , volume: Volume
}

interface CastSessionCreated extends CastSessionUpdated {
    appId: string
  , appImages: Image[]
  , displayName: string
  , receiverFriendlyName: string
  , senderApps: SenderApplication[]
  , transportId: string
}

type MessageDefinitions = {
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


  , "main:serviceUp": ReceiverDevice
  , "main:serviceDown": { id: string }
  
  , "main:updateReceiverStatus": {
        id: string
      , status: ReceiverStatus
    }


  , "main:receiverDeviceUp": { receiverDevice: ReceiverDevice }
  , "main:receiverDeviceDown": { receiverDeviceId: string }
  , "main:receiverDeviceUpdated": {
        receiverDeviceId: string
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
