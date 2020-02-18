"use strict";

import { TypedPort } from "./TypedPort";

import { BridgeInfo } from "./bridge";
import { Receiver, ReceiverStatus } from "../types";
import { ReceiverSelectorMediaType } from "../background/receiverSelector";
import { ReceiverSelection
       , ReceiverSelectionCast
       , ReceiverSelectionStop } from "../background/receiverSelector/ReceiverSelector";

import Volume from "../shim/cast/classes/Volume";
import { MediaInfo } from "../shim/cast/media";


// TODO: Document messages properly
export type Messages = [
    {
        subject: "popup:/sendRequestedAppId"
      , data: {
            requestedAppId: string;
        }
    }
  , {
        subject: "popup:/populateReceiverList"
      , data: {
            receivers: Receiver[]
          , defaultMediaType: ReceiverSelectorMediaType
          , availableMediaTypes: ReceiverSelectorMediaType
        }
    }
  , { subject: "popup:/close" }

  , { subject: "receiverSelector:/selected", data: ReceiverSelection }
  , { subject: "receiverSelector:/stop", data: ReceiverSelection }
  , { subject: "main:/shimInitialized", data: { appId: string; }}
  , { subject: "main:/selectReceiverBegin" }
  , { subject: "shim:/selectReceiverEnd", data: ReceiverSelectionCast }
  , { subject: "shim:/selectReceiverStop", data: ReceiverSelectionStop }
  , { subject: "shim:/selectReceiverCancelled" }
  , { subject: "main:/sessionCreated" }
  , { subject: "shim:/serviceUp", data: { id: Receiver["id"] }}
  , { subject: "shim:/serviceDown", data: { id: Receiver["id"] }}
  , { subject: "shim:/initialized", data: BridgeInfo }
  , { subject: "shim:/launchApp", data: { receiver: Receiver }}

    // Session messages
  , { subject: "shim:/session/stopped" }
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
      , data: { volume: Volume }
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
          , media: MediaInfo
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
  , { subject: "main:/receiverSelector/selected", data: ReceiverSelectionCast }
  , { subject: "main:/receiverSelector/error", data: string }
  , { subject: "main:/receiverSelector/close" }
  , { subject: "main:/receiverSelector/stop", data: ReceiverSelectionStop }

  , { subject: "bridge:/initialize", data: { shouldWatchStatus: boolean }}
  , { subject: "bridge:/receiverSelector/open", data: any }
  , { subject: "bridge:/receiverSelector/close" }
  , { subject: "bridge:/stopReceiverApp", data: { receiver: Receiver }}
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
        subject: "bridge:/mediaServer/start"
      , data: { filePath: string, port: number }
    }
  , {
        subject: "mediaCast:/mediaServer/started"
      , data: { mediaPath: string, subtitlePaths: string[] }
    }
  , { subject: "mediaCast:/mediaServer/stopped" }
  , { subject: "mediaCast:/mediaServer/error" }

  , { subject: "main:/serviceUp", data: Receiver }
  , { subject: "main:/serviceDown", data: { id: string }}
  , {
        subject: "main:/receiverStatus"
      , data: { id: string, status: ReceiverStatus }
    }
];

export type Port = TypedPort<Messages>;
export type Message = Messages[number];


interface RuntimeConnectInfo {
    name: string;
}
interface TabConnectInfo {
    name: string;
    frameId: number;
}

export default {
    connect (connectInfo: RuntimeConnectInfo) {
        return browser.runtime.connect(connectInfo) as
                unknown as TypedPort<Messages>;
    }

  , connectTab (tabId: number, connectInfo: TabConnectInfo) {
        return browser.tabs.connect(tabId, connectInfo) as
                unknown as TypedPort<Messages>;
    }

  , onConnect: {
        addListener (cb: (port: TypedPort<Messages>) => void) {
            browser.runtime.onConnect.addListener(cb as any);
        }
      , removeListener (cb: (port: TypedPort<Messages>) => void) {
            browser.runtime.onConnect.removeListener(cb as any);
        }
      , hasListener (cb: (port: TypedPort<Messages>) => void) {
            return browser.runtime.onConnect.hasListener(cb as any);
        }
    }
};
