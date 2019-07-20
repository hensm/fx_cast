"use strict";

import NativeMacReceiverSelector
    from "./NativeMacReceiverSelector";
import PopupReceiverSelector
    from "./PopupReceiverSelector";


import ReceiverSelector, {
         ReceiverSelection
       , ReceiverSelectorCancelledEvent
       , ReceiverSelectorErrorEvent
       , ReceiverSelectorMediaType
       , ReceiverSelectorSelectedEvent } from "./ReceiverSelector";

export {
    ReceiverSelector
  , ReceiverSelection
  , ReceiverSelectorCancelledEvent
  , ReceiverSelectorErrorEvent
  , ReceiverSelectorMediaType
  , ReceiverSelectorSelectedEvent
};

export enum ReceiverSelectorType {
    Popup
  , NativeMac
}

export function getReceiverSelector (type: ReceiverSelectorType) {
    switch (type) {
        case ReceiverSelectorType.Popup: {
            return new PopupReceiverSelector();
        }
        case ReceiverSelectorType.NativeMac: {
            return new NativeMacReceiverSelector();
        }
    }
}
