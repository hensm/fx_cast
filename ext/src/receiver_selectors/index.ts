"use strict";

import NativeMacReceiverSelector
    from "./NativeMacReceiverSelector";
import PopupReceiverSelector
    from "./PopupReceiverSelector";


export { ReceiverSelection
       , ReceiverSelectorCancelledEvent
       , ReceiverSelectorErrorEvent
       , ReceiverSelectorMediaType
       , ReceiverSelectorSelectedEvent } from "./ReceiverSelector";


export enum ReceiverSelectorType {
    Popup
  , NativeMac
}

export function getReceiverSelector (
        type: ReceiverSelectorType) {

    switch (type) {
        case ReceiverSelectorType.Popup: {
            return new PopupReceiverSelector();
        }
        case ReceiverSelectorType.NativeMac: {
            return new NativeMacReceiverSelector();
        }
    }
}
