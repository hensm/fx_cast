"use strict";

import logger from "./logger";
import { stringify } from "./utils";

import {
    ReceiverSelection,
    ReceiverSelectionActionType,
    ReceiverSelectorMediaType
} from "../background/receiverSelector";

import CastManager from "../cast/CastManager";

interface LoadSenderOptions {
    tabId: number;
    frameId?: number;
    selection: ReceiverSelection;
}

/**
 * Loads the appropriate sender for a given receiver
 * selector response.
 */
export default async function loadSender(opts: LoadSenderOptions) {
    // Cancelled
    if (!opts.selection) {
        return;
    }

    if (opts.selection.actionType !== ReceiverSelectionActionType.Cast) {
        return;
    }

    switch (opts.selection.mediaType) {
        case ReceiverSelectorMediaType.App: {
            const instance = CastManager.getInstance(opts.tabId, opts.frameId);
            if (!instance) {
                throw logger.error(
                    `Cast instance not found at tabId ${opts.tabId} / frameId ${opts.frameId}`
                );
            }

            instance.contentPort.postMessage({
                subject: "cast:launchApp",
                data: { receiverDevice: opts.selection.receiverDevice }
            });

            break;
        }

        case ReceiverSelectorMediaType.Tab:
        case ReceiverSelectorMediaType.Screen: {
            await browser.tabs.executeScript(opts.tabId, {
                code: stringify`
                    window.selectedMedia = ${opts.selection.mediaType};
                    window.selectedReceiver = ${opts.selection.receiverDevice};
                `,
                frameId: opts.frameId
            });

            await browser.tabs.executeScript(opts.tabId, {
                file: "senders/mirroring.js",
                frameId: opts.frameId
            });

            break;
        }

        case ReceiverSelectorMediaType.File: {
            const fileUrl = new URL(`file://${opts.selection.filePath}`);
            const { init } = await import("../senders/media");

            init({
                mediaUrl: fileUrl.href,
                receiver: opts.selection.receiverDevice
            });

            break;
        }
    }
}
