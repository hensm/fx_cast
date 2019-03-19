"use strict";

import cast from "../cast";

import ActiveInputStateEventData from "./classes/ActiveInputStateEventData";
import ApplicationMetadata from "./classes/ApplicationMetadata";
import ApplicationMetadataEventData from "./classes/ApplicationMetadataEventData";
import ApplicationStatusEventData from "./classes/ApplicationStatusEventData";
import CastContext from "./classes/CastContext";
import CastOptions from "./classes/CastOptions";
import CastSession from "./classes/CastSession";
import CastStateEventData from "./classes/CastStateEventData";
import EventData from "./classes/EventData";
import MediaSessionEventData from "./classes/MediaSessionEventData";
import RemotePlayer from "./classes/RemotePlayer";
import RemotePlayerChangedEvent from "./classes/RemotePlayerChangedEvent";
import RemotePlayerController from "./classes/RemotePlayerController";
import SessionStateEventData from "./classes/SessionStateEventData";
import VolumeEventData from "./classes/VolumeEventData";

import { ActiveInputState
       , CastContextEventType
       , CastState
       , LoggerLevel
       , RemotePlayerEventType
       , SessionEventType
       , SessionState } from "./enums";


import { onMessage } from "../messageBridge";


let castContext: CastContext = null;

export default {
    // Enums
    ActiveInputState, CastContextEventType, CastState, LoggerLevel
  , RemotePlayerEventType, SessionEventType, SessionState

    // Classes
  , ActiveInputStateEventData, ApplicationMetadata
  , ApplicationMetadataEventData, ApplicationStatusEventData, CastOptions
  , CastSession, CastStateEventData, EventData, MediaSessionEventData
  , RemotePlayer, RemotePlayerChangedEvent, RemotePlayerController
  , SessionStateEventData, VolumeEventData

  , CastContext: Object.assign(CastContext, {
        getInstance () {
            if (castContext) {
                return castContext;
            }

            castContext = new CastContext();
            return castContext;
        }
    })

  , VERSION: "1.0.07"

  , setLoggerLevel (level: number) {
        console.info("STUB :: cast.framework.setLoggerLevel");
    }
};
