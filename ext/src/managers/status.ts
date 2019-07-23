"use strict";

import nativeMessaging from "../lib/nativeMessaging";
import options from "../lib/options";

import { TypedEventTarget } from "../lib/typedEvents";
import { Message, Receiver, ReceiverStatus } from "../types";

import { ReceiverStatusMessage
       , ServiceDownMessage
       , ServiceUpMessage } from "../messageTypes";


let applicationName: string;


interface StatusManagerEvents {
    "serviceUp": ServiceUpMessage["data"];
    "serviceDown": ServiceDownMessage["data"];
    "statusUpdate": ReceiverStatusMessage["data"];
}

class StatusManager
        extends TypedEventTarget<StatusManagerEvents> {

    private bridgePort: browser.runtime.Port;
    private _receivers = new Map<string, Receiver>();

    public get receivers () {
        return this._receivers;
    }

    constructor () {
        super();

        // Bind listeners
        this.onBridgePortMessage = this.onBridgePortMessage.bind(this);
        this.onBridgePortDisconnect = this.onBridgePortDisconnect.bind(this);

        this.initBridgePort();
    }

    private async initBridgePort () {
        if (!applicationName) {
            applicationName = await options.get("bridgeApplicationName");
        }

        this.bridgePort = nativeMessaging.connectNative(applicationName);
        this.bridgePort.onMessage.addListener(this.onBridgePortMessage);
        this.bridgePort.onDisconnect.addListener(this.onBridgePortDisconnect);

        this.bridgePort.postMessage({
            subject: "bridge:/initialize"
          , data: {
                shouldWatchStatus: true
            }
        });
    }

    /**
     * Handles incoming bridge status messages, manages the
     * receiver list, and dispatches events.
     */
    private onBridgePortMessage (message: Message) {
        switch (message.subject) {
            case "shim:/serviceUp": {
                const { data: receiver } = (message as ServiceUpMessage);
                this._receivers.set(receiver.id, receiver);

                const serviceUpEvent = new CustomEvent("serviceUp", {
                    detail: receiver
                });

                this.dispatchEvent(serviceUpEvent);

                break;
            }

            case "shim:/serviceDown": {
                const { data: { id }} = (message as ServiceDownMessage);

                if (this._receivers.has(id)) {
                    this._receivers.delete(id);
                }

                const serviceDownEvent = new CustomEvent("serviceDown", {
                    detail: { id }
                });

                this.dispatchEvent(serviceDownEvent);

                break;
            }

            case "receiverStatus": {
                const { data: { id, status }}
                        = (message as ReceiverStatusMessage);

                const receiver = this._receivers.get(id);

                // Merge with existing
                this._receivers.set(id, {
                    ...receiver
                  , status: {
                        ...receiver.status
                      , ...status
                    }
                });
            }
        }
    }

    /**
     * Runs once the status bridge has disconnected. Sends
     * serviceDown messages for all receivers to all shims to
     * update receiver availability, then clears the receiver
     * list.
     *
     * Attempts to reinitialize the status bridge after 10
     * seconds. If it fails immediately, this handler will be
     * triggered again and the timer is reset for another 10
     * seconds.
     */
    private onBridgePortDisconnect () {
        for (const [, receiver] of this._receivers) {
            const serviceDownEvent = new CustomEvent("serviceDown", {
                detail: { id: receiver.id }
            });

            this.dispatchEvent(serviceDownEvent);
        }

        // Cleanup
        this._receivers.clear();
        this.bridgePort.onDisconnect.removeListener(
                this.onBridgePortDisconnect);
        this.bridgePort.onMessage.removeListener(this.onBridgePortMessage);
        this.bridgePort = null;

        window.setTimeout(async () => {
            this.initBridgePort();
        }, 10000);
    }
}


export default new StatusManager();
