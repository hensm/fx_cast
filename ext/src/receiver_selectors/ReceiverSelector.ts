"use strict";

import { Receiver } from "../types";


export enum ReceiverSelectorMediaType {
    App = 1
  , Tab = 2
  , Screen = 4
}

export interface ReceiverSelection {
    receiver: Receiver;
    mediaType: ReceiverSelectorMediaType;
}

export type ReceiverSelectorSelectedEvent = CustomEvent<ReceiverSelection>;
export type ReceiverSelectorErrorEvent = CustomEvent;
export type ReceiverSelectorCancelledEvent = CustomEvent;


export default interface ReceiverSelector extends EventTarget {
    open (receivers: Receiver[]
        , defaultMediaType: ReceiverSelectorMediaType
        , availableMediaTypes: ReceiverSelectorMediaType): void;

    close (): void;
}
