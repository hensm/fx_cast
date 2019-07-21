"use strict";

import * as cast from "./cast";

import { BridgeInfo } from "../lib/getBridgeInfo";
import { Message } from "../types";
import { onMessage } from "./eventMessageChannel";


let initializedBridgeInfo: BridgeInfo;

/**
 * To support exporting an API from a module, we need to
 * retain the event-based message passing despite not
 * actually crossing any context boundaries. The shim listens
 * for and emits these messages, and changing that behavior
 * is too messy.
 */
export function ensureInit (): Promise<BridgeInfo> {
    return new Promise(async (resolve, reject) => {

        // If already initialized, just return existing bridge info
        if (initializedBridgeInfo) {
            if (initializedBridgeInfo.isVersionCompatible) {
                resolve(initializedBridgeInfo);
            } else {
                reject();
            }

            return;
        }

        // Trigger message port setup side-effects
        import("./contentBridge");

        onMessage(message => {
            switch (message.subject) {
                case "shim:/initialized": {
                    const bridgeInfo: BridgeInfo = message.data;

                    if (bridgeInfo.isVersionCompatible) {
                        resolve(bridgeInfo);
                    } else {
                        reject();
                    }

                    initializedBridgeInfo = bridgeInfo;
                }
            }
        });
    });
}

export default cast;
