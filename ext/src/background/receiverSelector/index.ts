"use strict";

import NativeReceiverSelector from "./NativeReceiverSelector";
import PopupReceiverSelector from "./PopupReceiverSelector";


export type ReceiverSelector =
        NativeReceiverSelector
      | PopupReceiverSelector;

export enum ReceiverSelectorType {
    Popup
  , Native
}

export { ReceiverSelection
       , ReceiverSelectionActionType
       , ReceiverSelectorMediaType } from "./ReceiverSelector";
