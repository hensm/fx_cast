"use strict";

import { ReceiverStatus } from "./castTypes";


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


export type Messages = [
    {
        subject: "shim:/serviceUp"
      , data: { id: Receiver["id"] }
    }
  , {
        subject: "shim:/serviceDown"
      , data: { id: Receiver["id"] }
    }
  , {
        subject: "shim:/launchApp"
      , data: { receiver: Receiver }
    }

    // Session messages
  , {
        subject: "shim:/session/stopped"
    }
  , {
        subject: "shim:/session/connected"
      , data: {
            sessionId: string;
            namespaces: Array<{ name: string }>;
            displayName: string;
            statusText: string;
        }
    }
  , {
        subject: "shim:/session/updateStatus"
      , data: any
    }
  , {
        subject: "shim:/session/impl_addMessageListener"
      , data: { namespace: string, data: string }
    }
  , {
        subject: "shim:/session/impl_sendMessage"
      , data: { messageId: string, error: boolean }
    }
  , {
        subject: "shim:/session/impl_setReceiverMuted"
      , data: { volumeId: string, error: boolean }
    }
  , {
        subject: "shim:/session/impl_setReceiverVolumeLevel"
      , data: { volumeId: string, error: boolean }
    }
  , {
        subject: "shim:/session/impl_stop"
      , data: { stopId: string, error: boolean }
    }

    // Bridge session messages
  , {
        subject: "bridge:/session/initialize"
      , data: {
            address: string
          , port: number
          , appId: string
          , sessionId: string
        }
      , _id: string;
    }
  , {
        subject: "bridge:/session/close"
      , _id: string;
    }
  , {
        subject: "bridge:/session/impl_leave"
      , data: { id: string }
      , _id: string
    }
  , {
        subject: "bridge:/session/impl_sendMessage"
      , data: { namespace: string, message: any, messageId: string }
      , _id: string
    }
  , {
        subject: "bridge:/session/impl_setReceiverMuted"
      , data: { muted: boolean, volumeId: string }
      , _id: string
    }
  , {
        subject: "bridge:/session/impl_setReceiverVolumeLevel"
      , data: { newLevel: number, volumeId: string }
      , _id: string
    }
  , {
        subject: "bridge:/session/impl_stop"
      , data: { stopId: string }
      , _id: string
    }
  , {
        subject: "bridge:/session/impl_addMessageListener"
      , data: { namespace: string }
      , _id: string
    }

    // Media messages
  , {
        subject: "shim:/media/update"
      , data: {
            currentTime: number
          , _lastCurrentTime: number
          , customData: any
          , playbackRate: number
          , playerState: string
          , repeatMode: string
          , _volumeLevel: number
          , _volumeMuted: boolean
          , media: any
          , mediaSessionId: number
        }
    }
  , {
        subject: "shim:/media/sendMediaMessageResponse"
      , data: { messageId: string, error: boolean }
    }

    // Bridge media messages
  , {
        subject: "bridge:/media/initialize"
      , data: {
            sessionId: string
          , mediaSessionId: number
          , _internalSessionId: string
        }
      , _id: string;
    }
  , {
        subject: "bridge:/media/sendMediaMessage"
      , data: { message: any, messageId: string }
      , _id: string;
    }

    // Bridge messages
  , {
        subject: "main:/receiverSelector/selected"
      , data: ReceiverSelectionCast
    }
  , {
        subject: "main:/receiverSelector/error"
      , data: string
    }
  , {
        subject: "main:/receiverSelector/close"
    }
  , {
        subject: "main:/receiverSelector/stop"
      , data: ReceiverSelectionStop
    }
  , {
        subject: "bridge:/getInfo"
    }
  , {
        subject: "bridge:/initialize"
      , data: { shouldWatchStatus: boolean }
    }
  , {
        subject: "bridge:/receiverSelector/open"
      , data: any }
  , {
        subject: "bridge:/receiverSelector/close"
    }
  , {
        subject: "bridge:/stopReceiverApp"
      , data: { receiver: Receiver }
    }
  , {
        subject: "bridge:/mediaServer/start"
      , data: { filePath: string, port: number }
    }
    , {
        subject: "bridge:/mediaServer/stop"
    }

  , {
        subject: "mediaCast:/mediaServer/started"
      , data: { mediaPath: string, subtitlePaths: string[] }
    }
  , {
        subject: "mediaCast:/mediaServer/stopped"
    }
  , {
        subject: "mediaCast:/mediaServer/error"
    }

  , {
        subject: "main:/serviceUp"
      , data: Receiver
    }
  , {
        subject: "main:/serviceDown"
      , data: { id: string }
    }
  , {
        subject: "main:/receiverStatus"
      , data: { id: string, status: ReceiverStatus }
    }
];

export type Message = Messages[number];

export interface Receiver {
    host: string;
    friendlyName: string;
    id: string;
    port: number;
    status?: ReceiverStatus;
}

export type SendMessageCallback = (message: Message) => void;
