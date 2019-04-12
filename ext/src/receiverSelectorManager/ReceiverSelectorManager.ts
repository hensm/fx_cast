"use strict";

import { Receiver } from "../types";


export enum ReceiverSelectorMediaType {
    App
  , Tab
  , Screen
}

export interface ReceiverSelection {
    receiver: Receiver;
    castMethod: ReceiverSelectorMediaType;
}

export type ReceiverSelectorSelectedEvent = CustomEvent<ReceiverSelection>;
export type ReceiverSelectorErrorEvent = CustomEvent;
export type ReceiverSelectorCancelledEvent = CustomEvent;


export default interface ReceiverSelectorManager extends EventTarget {
    open (receivers: Receiver[]
        , defaultMediaType: ReceiverSelectorMediaType): void;

    close (): void;
}
