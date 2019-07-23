"use strict";

import NativeMacReceiverSelector
    from "./NativeMacReceiverSelector";
import PopupReceiverSelector
    from "./PopupReceiverSelector";


import { ReceiverSelection
       , ReceiverSelectorMediaType } from "./ReceiverSelector";

type ReceiverSelector = ReturnType<typeof getReceiverSelector>;

export {
    ReceiverSelector
  , ReceiverSelection
  , ReceiverSelectorMediaType
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
