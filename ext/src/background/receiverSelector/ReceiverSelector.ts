"use strict";

import { TypedEventTarget } from "../../lib/typedEvents";
import { Receiver } from "../../types";


export enum ReceiverSelectorMediaType {
    App = 1
  , Tab = 2
  , Screen = 4
  , File = 8
}

export interface ReceiverSelection {
    receiver: Receiver;
    mediaType: ReceiverSelectorMediaType;
    filePath?: string;
}


export interface ReceiverSelectorEvents {
    "selected": ReceiverSelection;
    "error": string;
    "cancelled": void;
}

export default interface ReceiverSelector
        extends TypedEventTarget<ReceiverSelectorEvents> {

    readonly isOpen: boolean;

    open (receivers: Receiver[]
        , defaultMediaType: ReceiverSelectorMediaType
        , availableMediaTypes: ReceiverSelectorMediaType): void;

    close (): void;
}
