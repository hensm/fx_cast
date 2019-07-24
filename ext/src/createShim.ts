"use strict";

import bridge from "./lib/bridge";
import options from "./lib/options";

import { TypedEventTarget } from "./lib/typedEvents";
import { Message } from "./types";

import { ReceiverSelectorMediaType } from "./receiver_selectors";

import SelectorManager from "./SelectorManager";
import StatusManager from "./StatusManager";


interface Shim {
    bridgePort: browser.runtime.Port;

    contentPort?: browser.runtime.Port;
    contentTabId?: number;
    contentFrameId?: number;
}

export async function createShim (port: browser.runtime.Port): Promise<Shim> {
    const contentPort = port;
    const contentTabId = port.sender.tab.id;
    const contentFrameId = port.sender.frameId;

    const bridgePort = await bridge.connect();

    bridgePort.onMessage.addListener((message: Message) => {
        contentPort.postMessage(message);
    });

    contentPort.onMessage.addListener(async (message: Message) => {
        const [ destination ] = message.subject.split(":/");
        if (destination === "bridge") {
            bridgePort.postMessage(message);
        }

        switch (message.subject) {
            case "main:/shimInitialized": {
                for (const receiver of StatusManager.getReceivers()) {
                    contentPort.postMessage({
                        subject: "shim:/serviceUp"
                      , data: { id: receiver.id }
                    });
                }

                break;
            }

            case "main:/selectReceiverBegin": {
                const allMediaTypes =
                        ReceiverSelectorMediaType.App
                      | ReceiverSelectorMediaType.Tab
                      | ReceiverSelectorMediaType.Screen
                      | ReceiverSelectorMediaType.File;

                try {
                    const selection = await SelectorManager.getSelection(
                            ReceiverSelectorMediaType.App
                          , allMediaTypes);

                    // Handle cancellation
                    if (!selection) {
                        contentPort.postMessage({
                            subject: "shim:/selectReceiverCancelled"
                        });

                        break;
                    }

                    /**
                     * If the media type returned from the selector has been
                     * changed, we need to cancel the current sender and switch
                     * it out for the right one.
                     */
                    if (selection.mediaType !== ReceiverSelectorMediaType.App) {
                        contentPort.postMessage({
                            subject: "shim:/selectReceiverCancelled"
                        });

                        break;
                    }

                    // Pass selection back to shim
                    contentPort.postMessage({
                        subject: "shim:/selectReceiverEnd"
                      , data: selection
                    });
                } catch (err) {
                    // TODO: Report errors properly
                    contentPort.postMessage({
                        subject: "shim:/selectReceiverCancelled"
                    });
                }

                break;
            }

            case "main:/sessionCreated": {
                const selector = await SelectorManager.getSharedSelector();
                if (selector.isOpen) {
                    selector.close();
                }

                break;
            }
        }
    });

    return {
        bridgePort
      , contentPort
      , contentTabId
      , contentFrameId
    };
}
