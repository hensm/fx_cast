"use strict";

import * as cast from "./cast";

import { BridgeInfo } from "../lib/getBridgeInfo";
import { Message } from "../types";
import { onMessage } from "./eventMessageChannel";


/**
 * To support exporting an API from a module, we need to
 * retain the event-based message passing despite not
 * actually crossing any context boundaries. The shim listens
 * for and emits these messages, and changing that behavior
 * is too messy.
 */
export function init (): Promise<BridgeInfo> {
    return new Promise(async (resolve, reject) => {

        // Trigger message port setup side-effects
        import("./contentBridge");

        onMessage(message => {
            switch (message.subject) {
                case "shim:/initialized": {
                    const bridgeInfo: BridgeInfo = message.data;
                    resolve(bridgeInfo);
                }
            }
        });
    });
}

export default cast;
