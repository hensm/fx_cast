"use strict";

import ReceiverSelectorManager, {
        ReceiverSelectorMediaType } from "../ReceiverSelectorManager";

import { Message, Receiver } from "../../types";


class NativeMacReceiverSelectorManager
        extends EventTarget
        implements ReceiverSelectorManager {

    public async open (
            receivers: Receiver[]
          , defaultMediaType: ReceiverSelectorMediaType): Promise<void> {
        console.info("STUB :: NativeMacReceiverSelectorManager.open");
    }

    public close (): void {
        console.info("STUB :: NativeMacReceiverSelectorManager.close");
    }
}

// Singleton instance
export default new NativeMacReceiverSelectorManager();
