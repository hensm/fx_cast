"use strict";

import { TypedEventTarget } from "../../lib/TypedEventTarget";
import { ReceiverDevice } from "../../types";


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

export type ReceiverSelection = ReceiverSelectionCast | ReceiverSelectionStop;


interface ReceiverSelectorEvents {
    "selected": ReceiverSelectionCast;
    "error": string;
    "cancelled": void;
    "stop": ReceiverSelectionStop;
}

export default abstract class ReceiverSelector
        extends TypedEventTarget<ReceiverSelectorEvents> {

    abstract readonly isOpen: boolean;

    abstract open (
            receivers: ReceiverDevice[]
          , defaultMediaType: ReceiverSelectorMediaType
          , availableMediaTypes: ReceiverSelectorMediaType
          , appId?: string): void;

    abstract update (receivers: ReceiverDevice[]): void;

    abstract close (): void;
}
