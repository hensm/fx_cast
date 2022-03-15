"use strict";

import { ReceiverDevice } from "../../types";

export enum ReceiverSelectorType {
    Popup,
    Native
}

export enum ReceiverSelectorMediaType {
    None = 0,
    App = 1,
    Tab = 2,
    Screen = 4,
    File = 8
}

export enum ReceiverSelectionActionType {
    Cast = 1,
    Stop = 2
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

export type ReceiverSelection = ReceiverSelectionCast | ReceiverSelectionStop;
