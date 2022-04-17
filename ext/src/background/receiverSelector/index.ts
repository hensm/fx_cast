"use strict";

import { ReceiverDevice } from "../../types";

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
    receiverDevice: ReceiverDevice;
    mediaType: ReceiverSelectorMediaType;
    filePath?: string;
}
export interface ReceiverSelectionStop {
    actionType: ReceiverSelectionActionType.Stop;
    receiverDevice: ReceiverDevice;
}

export type ReceiverSelection = ReceiverSelectionCast | ReceiverSelectionStop;
