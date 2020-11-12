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

/**
 * Message types.
 * Keep in sync with types at /ext/src/messaging.ts.
 */
type MessagesBase = {
    "main:/serviceUp": Receiver
  , "main:/serviceDown": { id: string }
  , "main:/receiverStatus": { id: string, status: ReceiverStatus }

  , "shim:/serviceUp": { id: Receiver["id"] }
  , "shim:/serviceDown": { id: Receiver["id"] }
  , "shim:/launchApp": { receiver: Receiver }

  , "shim:/session/stopped": {}
  , "shim:/session/connected": {
        sessionId: string;
        namespaces: Array<{ name: string }>;
        displayName: string;
        statusText: string;
    }
  , "shim:/session/updateStatus": any

  , "shim:/session/impl_addMessageListener": {
        namespace: string
      , data: string
    }
  , "shim:/session/impl_sendMessage": {
        messageId: string
      , error: boolean
    }
  , "shim:/session/impl_setReceiverMuted": {
        volumeId: string
      , error: boolean
    }
  , "shim:/session/impl_setReceiverVolumeLevel": {
        volumeId: string
      , error: boolean
    }
  , "shim:/session/impl_stop": {
        stopId: string
      , error: boolean
    }

    // Bridge session messages
  , "bridge:/session/initialize": {
        address: string
      , port: number
      , appId: string
      , sessionId: string
      , internalSessionId: string;
    }
  , "bridge:/session/close": {
        internalSessionId: string
    }
  , "bridge:/session/impl_leave": {
        internalSessionId: string
      , id: string
    }
  , "bridge:/session/impl_sendMessage": {
        internalSessionId: string
      , namespace: string
      , message: any
      , messageId: string
    }
  , "bridge:/session/impl_setReceiverMuted": {
        internalSessionId: string
      , muted: boolean
      , volumeId: string
    }
  , "bridge:/session/impl_setReceiverVolumeLevel": {
        internalSessionId: string
      , newLevel: number
      , volumeId: string
    }
  , "bridge:/session/impl_stop": {
        internalSessionId: string
      , stopId: string
    }
  , "bridge:/session/impl_addMessageListener": {
        internalSessionId: string
      , namespace: string
    }

    // Media messages
  , "shim:/media/update": {
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
  , "shim:/media/sendMediaMessageResponse": {
        messageId: string
      , error: boolean
    }

    // Bridge media messages
  , "bridge:/media/initialize": {
        sessionId: string
      , mediaSessionId: number
      , internalMediaSessionId: string
      , _internalSessionId: string
    }
  , "bridge:/media/sendMediaMessage": {
        internalMediaSessionId: string
      , message: any
      , messageId: string
    }

    // Bridge messages
  , "main:/receiverSelector/selected": ReceiverSelectionCast
  , "main:/receiverSelector/error": string
  , "main:/receiverSelector/close": {}
  , "main:/receiverSelector/stop": ReceiverSelectionStop

  , "bridge:/getInfo": {}
  , "bridge:/initialize": {
        shouldWatchStatus: boolean
    }
  , "bridge:/receiverSelector/open": {
        receivers: Receiver[]
      , defaultMediaType: ReceiverSelectorMediaType
      , availableMediaTypes: ReceiverSelectorMediaType
      , closeIfFocusLost: boolean
      , windowPositionX: number
      , windowPositionY: number

      , i18n_extensionName: string
      , i18n_castButtonTitle: string
      , i18n_stopButtonTitle: string
      , i18n_mediaTypeApp:  string
      , i18n_mediaTypeTab: string
      , i18n_mediaTypeScreen: string
      , i18n_mediaTypeFile: string
      , i18n_mediaSelectCastLabel: string
      , i18n_mediaSelectToLabel: string
      , i18n_noReceiversFound: string
    }
  , "bridge:/receiverSelector/close": {}
  , "bridge:/stopReceiverApp": {
        receiver: Receiver
    }
  , "bridge:/mediaServer/start": {
        filePath: string
      , port: number
    }
  , "bridge:/mediaServer/stop": {}

  , "mediaCast:/mediaServer/started": {
        mediaPath: string
      , subtitlePaths: string[]
      , localAddress: string
    }
  , "mediaCast:/mediaServer/stopped": {}
  , "mediaCast:/mediaServer/error": {}
}

interface MessageBase<K extends keyof MessagesBase> {
    subject: K;
    data: MessagesBase[K];
}

type Messages = {
    [K in keyof MessagesBase]: MessageBase<K>
}

export type Message = Messages[keyof Messages];
