"use strict";

import { TypedEventTarget } from "../../lib/TypedEventTarget";
import { Receiver } from "../../types";


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

export type ReceiverSelection = ReceiverSelectionCast | ReceiverSelectionStop;


export interface ReceiverSelectorEvents {
    "selected": ReceiverSelectionCast;
    "error": string;
    "cancelled": void;
    "stop": ReceiverSelectionStop;
}

export default interface ReceiverSelector
        extends TypedEventTarget<ReceiverSelectorEvents> {

    readonly isOpen: boolean;

    open (receivers: Receiver[]
        , defaultMediaType: ReceiverSelectorMediaType
        , availableMediaTypes: ReceiverSelectorMediaType
        , requestedAppId: string): void;

    close (): void;
}
