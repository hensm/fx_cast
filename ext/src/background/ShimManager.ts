"use strict";

import bridge from "../lib/bridge";
import loadSender from "../lib/loadSender";
import logger from "../lib/logger";
import { Message, Port } from "../messaging";
import options from "../lib/options";

import { ReceiverSelectionActionType
       , ReceiverSelectorMediaType } from "./receiverSelector";

import ReceiverSelectorManager
    from "./receiverSelector/ReceiverSelectorManager";

import StatusManager from "./StatusManager";


type AnyPort = Port | MessagePort;

export interface Shim {
    bridgePort: Port;
    contentPort: AnyPort;
    contentTabId?: number;
    contentFrameId?: number;
    requestedAppId?: string;
}


// tslint:disable-next-line:new-parens
export default new class ShimManager {
    private activeShims = new Set<Shim>();

    public async init () {
        await this.initStatusListeners();
    }

    public getShim (tabId: number, frameId?: number) {
        for (const activeShim of this.activeShims) {
            if (activeShim.contentTabId === tabId) {
                if (frameId && activeShim.contentFrameId !== frameId) {
                    continue;
                }

                return activeShim;
            }
        }
    }

    public async createShim (port: AnyPort) {
        const shim = await (port instanceof MessagePort
            ? this.createShimFromBackground(port)
            : this.createShimFromContent(port));

        shim.contentPort.postMessage({
            subject: "shim:/initialized"
          , data: await bridge.getInfo()
        });

        this.activeShims.add(shim);
    }

    private async createShimFromBackground (
            contentPort: MessagePort): Promise<Shim> {

        const shim: Shim = {
            bridgePort: await bridge.connect()
          , contentPort
        };

        shim.bridgePort.onDisconnect.addListener(() => {
            contentPort.close();
            this.activeShims.delete(shim);
        });

        shim.bridgePort.onMessage.addListener(message => {
            contentPort.postMessage(message);
        });

        contentPort.addEventListener("message", ev => {
            this.handleContentMessage(shim, ev.data);
        });

        return shim;
    }

    private async createShimFromContent (
            contentPort: Port): Promise<Shim> {

        if (contentPort.sender?.tab?.id === undefined
         || contentPort.sender?.frameId === undefined) {
            throw logger.error("Content shim created with an invalid port context.");
        }

        /**
         * If there's already an active shim for the sender
         * tab/frame ID, disconnect it.
         */
        for (const activeShim of this.activeShims) {
            if (activeShim.contentTabId === contentPort.sender.tab.id
             && activeShim.contentFrameId === contentPort.sender.frameId) {
                activeShim.bridgePort.disconnect();
            }
        }

        const shim: Shim = {
            bridgePort: await bridge.connect()
          , contentPort
          , contentTabId: contentPort.sender.tab.id
          , contentFrameId: contentPort.sender.frameId
        };


        const onContentPortMessage = (message: Message) => {
            this.handleContentMessage(shim, message);
        };

        const onBridgePortMessage = (message: Message) => {
            contentPort.postMessage(message);
        };

        const onDisconnect = () => {
            shim.bridgePort.onMessage.removeListener(onBridgePortMessage);
            contentPort.onMessage.removeListener(onContentPortMessage);

            shim.bridgePort.disconnect();
            contentPort.disconnect();

            this.activeShims.delete(shim);
        };


        shim.bridgePort.onDisconnect.addListener(onDisconnect);
        shim.bridgePort.onMessage.addListener(onBridgePortMessage);

        contentPort.onDisconnect.addListener(onDisconnect);
        contentPort.onMessage.addListener(onContentPortMessage);

        return shim;
    }

    private async handleContentMessage (shim: Shim, message: Message) {
        const [ destination ] = message.subject.split(":/");
        if (destination === "bridge") {
            shim.bridgePort.postMessage(message);
        }

        switch (message.subject) {
            case "main:/shimReady": {
                shim.requestedAppId = message.data.appId;

                for (const receiver of StatusManager.getReceivers()) {
                    shim.contentPort.postMessage({
                        subject: "shim:/serviceUp"
                      , data: { id: receiver.id }
                    });
                }

                break;
            }

            case "main:/selectReceiverBegin": {
                if (shim.contentTabId === undefined
                 || shim.contentFrameId === undefined) {
                    throw logger.error("Shim associated with content sender missing tab/frame ID");
                }

                const contentTab = await browser.tabs.get(shim.contentTabId);

                try {
                    const selection =
                            await ReceiverSelectorManager.getSelection(
                                    shim.contentTabId, shim.contentFrameId);

                    // Handle cancellation
                    if (!selection) {
                        shim.contentPort.postMessage({
                            subject: "shim:/selectReceiverCancelled"
                        });

                        break;
                    }

                    switch (selection.actionType) {
                        case ReceiverSelectionActionType.Cast: {
                            /**
                             * If the media type returned from the selector has
                             * been changed, we need to cancel the current
                             * sender and switch it out for the right one.
                             */
                            if (selection.mediaType !==
                                    ReceiverSelectorMediaType.App) {

                                shim.contentPort.postMessage({
                                    subject: "shim:/selectReceiverCancelled"
                                });

                                loadSender({
                                    tabId: shim.contentTabId
                                  , frameId: shim.contentFrameId
                                  , selection
                                });

                                break;
                            }

                            shim.contentPort.postMessage({
                                subject: "shim:/selectReceiverEnd"
                              , data: selection
                            });

                            break;
                        }

                        case ReceiverSelectionActionType.Stop: {
                            shim.contentPort.postMessage({
                                subject: "shim:/selectReceiverStop"
                              , data: selection
                            });

                            break;
                        }
                    }
                } catch (err) {
                    // TODO: Report errors properly
                    shim.contentPort.postMessage({
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
                const selector = await ReceiverSelectorManager.getSelector();
                const shouldClose = await options.get(
                        "receiverSelectorWaitForConnection");

                if (selector.isOpen && shouldClose) {
                    selector.close();
                }

                break;
            }
        }
    }

    private async initStatusListeners () {
        StatusManager.addEventListener("serviceUp", ev => {
            for (const shim of this.activeShims) {
                shim.contentPort.postMessage({
                    subject: "shim:/serviceUp"
                  , data: { id: ev.detail.id }
                });
            }
        });

        StatusManager.addEventListener("serviceDown", ev => {
            for (const shim of this.activeShims) {
                shim.contentPort.postMessage({
                    subject: "shim:/serviceDown"
                  , data: { id: ev.detail.id }
                });
            }
        });
    }
};
