"use strict";

import bridge from "./lib/bridge";
import loadSender from "./lib/loadSender";
import options from "./lib/options";

import { TypedEventTarget } from "./lib/typedEvents";
import { Message } from "./types";

import { ReceiverSelectorMediaType } from "./receiver_selectors";

import SelectorManager from "./SelectorManager";
import StatusManager from "./StatusManager";


export interface Shim {
    bridgePort: browser.runtime.Port;
    contentPort?: browser.runtime.Port;
    contentTabId?: number;
    contentFrameId?: number;
}

export default async function createShim (
        port: browser.runtime.Port): Promise<Shim> {

    const contentPort = port;
    const contentTabId = port.sender.tab.id;
    const contentFrameId = port.sender.frameId;

    const bridgePort = await bridge.connect();


    /**
     * If either the bridge port or the content port disconnects,
     * just teardown all communication.
     */
    function onDisconnect () {
        bridgePort.onMessage.removeListener(onBridgePortMessage);
        contentPort.onMessage.removeListener(onContentPortMessage);

        // Ensure all ports are disconnected
        contentPort.disconnect();
        bridgePort.disconnect();
    }

    bridgePort.onDisconnect.addListener(onDisconnect);
    contentPort.onDisconnect.addListener(onDisconnect);


    // Add listeners
    bridgePort.onMessage.addListener(onBridgePortMessage);
    contentPort.onMessage.addListener(onContentPortMessage);

    function onBridgePortMessage (message: Message) {
        contentPort.postMessage(message);
    }

    async function onContentPortMessage (message: Message) {
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

                        loadSender({
                            tabId: contentTabId
                          , frameId: contentFrameId
                          , selection
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

            /**
             * TODO: If we're closing a selector, make sure it's the
             * same one that caused the session creation.
             */
            case "main:/sessionCreated": {
                const selector = await SelectorManager.getSharedSelector();

                const shouldClose = await options.get(
                        "receiverSelectorWaitForConnection");

                if (selector.isOpen && shouldClose) {
                    selector.close();
                }

                break;
            }
        }
    }


    contentPort.postMessage({
        subject: "shim:/initialized"
      , data: await bridge.getInfo()
    });

    return {
        bridgePort
      , contentPort
      , contentTabId
      , contentFrameId
    };
}
