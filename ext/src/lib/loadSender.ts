"use strict";

import { stringify } from "./utils";

import { ReceiverSelection
       , ReceiverSelectorMediaType } from "../receiver_selectors";


interface LoadSenderOptions {
    tabId: number;
    frameId: number;
    selection: ReceiverSelection;
}

/**
 * Loads the appropriate sender for a given receiver
 * selector response.
 */
export default async function loadSender (opts: LoadSenderOptions) {
    // Cancelled
    if (!opts.selection) {
        return;
    }

    switch (opts.selection.mediaType) {
        case ReceiverSelectorMediaType.Tab:
        case ReceiverSelectorMediaType.Screen: {
            await browser.tabs.executeScript(opts.tabId, {
                code: stringify`
                    window.selectedMedia = ${opts.selection.mediaType};
                    window.selectedReceiver = ${opts.selection.receiver};
                `
              , frameId: opts.frameId
            });

            await browser.tabs.executeScript(opts.tabId, {
                file: "senders/mirroringCast.js"
              , frameId: opts.frameId
            });

            break;
        }

        case ReceiverSelectorMediaType.File: {
            const fileUrl = new URL(`file://${opts.selection.filePath}`);
            const { init } = await import("../senders/mediaCast");

            init({
                mediaUrl: fileUrl.href
              , receiver: opts.selection.receiver
            });

            break;
        }
    }
}
