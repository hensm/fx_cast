"use strict";

import { Receiver } from "../types"


export type ReceiverSelectorSelectedEvent = CustomEvent<Receiver>;
export type ReceiverSelectorErrorEvent = CustomEvent;
export type ReceiverSelectorCancelledEvent = CustomEvent;

export enum ReceiverSelectorCastType {
    App
  , Tab
  , Screen
}

export default interface ReceiverSelectorManager extends EventTarget {
    open (
            receivers: Receiver[]
          , defaultCastType: ReceiverSelectorCastType): void;

    close (): void;
}
