"use strict";

import ReceiverSelectorManager, {
        ReceiverSelectorCastType } from "../ReceiverSelectorManager";

import { Receiver, Message } from "../../types";


class NativeMacReceiverSelectorManager
        extends EventTarget
        implements ReceiverSelectorManager {

    public async open (
            receivers: Receiver[]
          , defaultCastType: ReceiverSelectorCastType): Promise<void> {
        console.info("STUB :: NativeMacReceiverSelectorManager.open");
    }

    public close (): void {
        console.info("STUB :: NativeMacReceiverSelectorManager.close");
    }
}

// Singleton instance
export default new NativeMacReceiverSelectorManager();
