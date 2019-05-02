"use strict";

import NativeMacReceiverSelectorManager
    from "./selectorManagers/NativeMacReceiverSelectorManager";
import PopupReceiverSelectorManager
    from "./selectorManagers/PopupReceiverSelectorManager";


export { ReceiverSelection
       , ReceiverSelectorCancelledEvent
       , ReceiverSelectorErrorEvent
       , ReceiverSelectorMediaType
       , ReceiverSelectorSelectedEvent } from "./ReceiverSelectorManager";


export enum ReceiverSelectorManagerType {
    Popup
  , NativeMac
}

export function getReceiverSelectorManager (
        type: ReceiverSelectorManagerType) {

    switch (type) {
        case ReceiverSelectorManagerType.Popup: {
            return PopupReceiverSelectorManager;
        }
        case ReceiverSelectorManagerType.NativeMac: {
            return NativeMacReceiverSelectorManager;
        }
    }
}
