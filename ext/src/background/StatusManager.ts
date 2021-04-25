"use strict";

import bridge from "../lib/bridge";
import logger from "../lib/logger";
import { Message, Port } from "../messaging";

import { TypedEventTarget } from "../lib/TypedEventTarget";
import { Receiver, ReceiverStatus } from "../types";


interface EventMap {
    "serviceUp": Receiver;
    "serviceDown": { id: string };
    "statusUpdate": { id: string, status: ReceiverStatus };
}

// tslint:disable-next-line:new-parens
export default new class StatusManager
        extends TypedEventTarget<EventMap> {

    private bridgePort: (Port | null) = null;
    private receivers = new Map<string, Receiver>();

    constructor () {
        super();

        // Bind listeners
        this.onBridgePortMessage = this.onBridgePortMessage.bind(this);
        this.onBridgePortDisconnect = this.onBridgePortDisconnect.bind(this);
    }

    public async init () {
        if (!this.bridgePort) {
            this.bridgePort = await this.createBridgePort();
        }
    }

    public *getReceivers () {
        for (const [, receiver ] of this.receivers) {
            if (receiver.status && receiver.status.application
                                && receiver.status.volume) {
                yield receiver;
            }
        }
    }

    public async stopReceiverApp (receiver: Receiver) {
        if (!this.bridgePort) {
            return;
        }

        this.bridgePort.postMessage({
            subject: "bridge:stopReceiverApp"
          , data: { receiver }
        });
    }

    private async createBridgePort () {
        const bridgePort = await bridge.connect();
        bridgePort.onMessage.addListener(this.onBridgePortMessage);
        bridgePort.onDisconnect.addListener(this.onBridgePortDisconnect);

        bridgePort.postMessage({
            subject: "bridge:initialize"
          , data: {
                shouldWatchStatus: true
            }
        });

        return bridgePort;
    }

    /**
     * Handles incoming bridge status messages, manages the
     * receiver list, and dispatches events.
     */
    private onBridgePortMessage (message: Message) {
        switch (message.subject) {
            case "main:serviceUp": {
                const { data: receiver } = message;
                this.receivers.set(receiver.id, receiver);

                this.dispatchEvent(new CustomEvent("serviceUp", {
                    detail: receiver
                }));

                break;
            }

            case "main:serviceDown": {
                const { data: { id }} = message;

                if (this.receivers.has(id)) {
                    this.receivers.delete(id);
                }

                this.dispatchEvent(new CustomEvent("serviceDown", {
                    detail: { id }
                }));

                break;
            }

            case "main:updateReceiverStatus": {
                const { data: { id, status }} = message;
                const receiver = this.receivers.get(id);

                if (!receiver) {
                    throw logger.error(`Could not find receiver (${id}) specified in status message.`);
                }

                // Merge with existing
                this.receivers.set(id, {
                    ...receiver
                  , status: {
                        ...receiver.status
                      , ...status
                    }
                });

                this.dispatchEvent(new CustomEvent("statusUpdate", {
                    detail: { id, status }
                }));
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

        if (this.bridgePort) {
            this.bridgePort.onDisconnect.removeListener(
                    this.onBridgePortDisconnect);
            this.bridgePort.onMessage.removeListener(
                    this.onBridgePortMessage);

            this.bridgePort = null;
        }

        window.setTimeout(async () => {
            this.bridgePort = await this.createBridgePort();
        }, 10000);
    }
};
