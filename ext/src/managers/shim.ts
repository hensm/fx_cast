"use strict";

import getBridgeInfo from "../lib/getBridgeInfo";
import nativeMessaging from "../lib/nativeMessaging";
import options from "../lib/options";

import { TypedEventTarget } from "../lib/typedEvents";
import { Message } from "../types";

import { ReceiverSelectorMediaType } from "../receiver_selectors";

import SelectorManager from "./selector";
import StatusManager from "./status";


let applicationName: string;


class Shim {
    public contentPort?: browser.runtime.Port;
    public contentTabId?: number;
    public contentFrameId?: number;

    public bridgePort: browser.runtime.Port;

    constructor (port?: browser.runtime.Port) {
        if (port) {
            this.contentPort = port;
            this.contentTabId = port.sender.tab.id;
            this.contentFrameId = port.sender.frameId;
        }

        this.bridgePort = nativeMessaging.connectNative(applicationName);
        this.bridgePort.onDisconnect.addListener(this.onBridgePortDisconnect);
        this.bridgePort.onMessage.addListener(this.onBridgePortMessage);

        getBridgeInfo().then(bridgeInfo => {
            port.postMessage({
                subject: "shim:/initialized"
              , data: bridgeInfo
            });
        });
    }

    private async onContentPortMessage (message: Message) {
        const [ destination ] = message.subject.split(":/");
        if (destination === "bridge") {
            this.bridgePort.postMessage(message);
            return;
        }

        switch (message.subject) {
            case "main:/shimInitialized": {
                // Send existing receivers as serviceUp messages
                for (const receiver of StatusManager.receivers.values()) {
                    this.contentPort.postMessage({
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

                    if (!selection) {
                        // Handle cancellation
                        this.contentPort.postMessage({
                            subject: "shim:/selectReceiverCancelled"
                        });

                        break;
                    }

                    /**
                     * If the media type returned from the selector has been
                     * changed, we need to cancel the current sender and switch
                     * it out for the right one.
                     *
                     * TODO: Seamlessly connect selector to the new sender
                     */
                    if (selection.mediaType !== ReceiverSelectorMediaType.App) {
                        this.contentPort.postMessage({
                            subject: "shim:/selectReceiverCancelled"
                        });

                        break;
                    }

                    // Pass selection back to shim
                    this.contentPort.postMessage({
                        subject: "shim:/selectReceiverEnd"
                      , data: selection
                    });
                } catch (err) {
                    // TODO: Report errors properly
                    this.contentPort.postMessage({
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
    }

    private onContentPortDisconnect () {
        this.bridgePort.disconnect();
    }

    private onBridgePortMessage (message: Message) {
        this.contentPort.postMessage(message);
    }

    private onBridgePortDisconnect () {
        if (this.bridgePort.error) {
            console.error(`${applicationName} disconnected:`
                  , this.bridgePort.error.message);
        } else {
            console.info(`${applicationName} disconnected`);
        }
    }
}

class ShimManager {
    private registeredShims = new Set<Shim>();

    public async createShim (port?: browser.runtime.Port) {
        if (!applicationName) {
            applicationName = await options.get("bridgeApplicationName");
        }

        const shim = new Shim(port);
        shim.contentPort.onDisconnect.addListener(() => {
            this.registeredShims.delete(shim);
        });

        this.registeredShims.add(shim);

        return shim;
    }

    public getShimForSender (sender: browser.runtime.MessageSender) {
        for (const shim of this.registeredShims) {
            if (shim.contentTabId
                  && shim.contentTabId === sender.tab.id
                  && shim.contentFrameId === sender.frameId) {
                return shim;
            }
        }

        return null;
    }
}


export default new ShimManager();
