"use strict";

import bridge from "./lib/bridge";
import options from "./lib/options";

import { TypedEventTarget } from "./lib/typedEvents";
import { Message, Receiver, ReceiverStatus } from "./types";


interface ReceiverStatusMessage extends Message {
    subject: "receiverStatus";
    data: {
        id: string;
        status: ReceiverStatus;
    };
}

interface ServiceDownMessage extends Message {
    subject: "shim:/serviceDown";
    data: {
        id: string;
    };
}

interface ServiceUpMessage extends Message {
    subject: "shim:/serviceUp";
    data: Receiver;
}



interface EventMap {
    "serviceUp": ServiceUpMessage["data"];
    "serviceDown": ServiceDownMessage["data"];
    "statusUpdate": ReceiverStatusMessage["data"];
}

export default new class extends TypedEventTarget<EventMap> {
    private bridgePort: browser.runtime.Port;
    private receivers = new Map<string, Receiver>();

    constructor () {
        super();

        // Bind listeners
        this.onBridgePortMessage = this.onBridgePortMessage.bind(this);
        this.onBridgePortDisconnect = this.onBridgePortDisconnect.bind(this);

        this.initBridgePort();
    }

    public getReceivers () {
        return Array.from(this.receivers.values());
    }

    private async initBridgePort () {
        this.bridgePort = await bridge.connect();
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
                this.receivers.set(receiver.id, receiver);

                const serviceUpEvent = new CustomEvent("serviceUp", {
                    detail: receiver
                });

                this.dispatchEvent(serviceUpEvent);

                break;
            }

            case "shim:/serviceDown": {
                const { data: { id }} = (message as ServiceDownMessage);

                if (this.receivers.has(id)) {
                    this.receivers.delete(id);
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

                const receiver = this.receivers.get(id);

                // Merge with existing
                this.receivers.set(id, {
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
        for (const [, receiver] of this.receivers) {
            const serviceDownEvent = new CustomEvent("serviceDown", {
                detail: { id: receiver.id }
            });

            this.dispatchEvent(serviceDownEvent);
        }

        // Cleanup
        this.receivers.clear();
        this.bridgePort.onDisconnect.removeListener(
                this.onBridgePortDisconnect);
        this.bridgePort.onMessage.removeListener(this.onBridgePortMessage);
        this.bridgePort = null;

        window.setTimeout(async () => {
            this.initBridgePort();
        }, 10000);
    }
};
