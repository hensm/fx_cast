"use strict";

import { ReceiverStatus } from "./components/chromecast/types";


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
    receiver: ReceiverDevice;
    mediaType: ReceiverSelectorMediaType;
    filePath?: string;
}

export interface ReceiverSelectionStop {
    actionType: ReceiverSelectionActionType.Stop;
    receiver: ReceiverDevice;
}

export interface ReceiverDevice {
    host: string;
    friendlyName: string;
    id: string;
    port: number;
    status?: ReceiverStatus;
}
