"use strict";

import CastClient from "./client";

import {
    MediaStatus,
    ReceiverMessage,
    ReceiverMediaMessage,
    ReceiverStatus,
    SenderMediaMessage
} from "./types";

const NS_MEDIA = "urn:x-cast:com.google.cast.media";

interface CastRemoteOptions {
    onApplicationFound?: () => void;
    onApplicationClose?: () => void;
    onReceiverStatusUpdate?: (status: ReceiverStatus) => void;
    onMediaStatusUpdate?: (status?: MediaStatus) => void;
}

/**
 * castv2 client for receiver tracking.
 */
export default class Remote extends CastClient {
    private transportClient?: RemoteTransport;

    constructor(private host: string, private options?: CastRemoteOptions) {
        super();
        super.connect(host, {
            onReceiverMessage: message => {
                this.onReceiverMessage(message);
            }
        }).then(() => {
            this.sendReceiverMessage({ type: "GET_STATUS" });
        });
    }

    disconnect() {
        super.disconnect();
        this.transportClient?.disconnect();
    }

    /**
     * Handle `NS_RECEIVER` messages from the receiver device.
     * On initial connection, a `GET_STATUS` message is sent that
     * results in a `RECEIVER_STATUS` response. If an application
     * is running, get the transport ID and make a connection to
     * receive media status updates.
     */
    private onReceiverMessage(message: ReceiverMessage) {
        if (message.type !== "RECEIVER_STATUS") {
            return;
        }

        const application = message.status.applications?.[0];
        if (!application || application.isIdleScreen) {
            // Handle app close
            if (this.transportClient) {
                this.transportClient = undefined;
                this.options?.onApplicationClose?.();
            }
        }

        // Update status before possible transport init
        this.options?.onReceiverStatusUpdate?.(message.status);

        // Handle app creation/discovery
        if (application && !this.transportClient) {
            this.transportClient = new RemoteTransport(
                application.transportId,
                message => this.onMediaMessage(message)
            );

            this.transportClient.connect(this.host).then(() => {
                this.transportClient?.sendMediaMessage({
                    type: "GET_STATUS"
                });
            });

            this.options?.onApplicationFound?.();
        }
    }

    /**
     * Handle `NS_MEDIA` messages from the receiver application.
     * On initial connection. a `GET_STATUS` message is sent that
     * results in a `MEDIA_STATUS` response.
     */
    private onMediaMessage(message: ReceiverMediaMessage) {
        if (message.type !== "MEDIA_STATUS") {
            return;
        }

        this.options?.onMediaStatusUpdate?.(message.status[0]);
    }
}

/**
 * castv2 client for receiver application tracking.
 */
class RemoteTransport extends CastClient {
    private mediaChannel = this.createChannel(NS_MEDIA);

    constructor(
        transportId: string,
        onMediaMessage: (message: ReceiverMediaMessage) => void
    ) {
        super(undefined, transportId);
        this.mediaChannel.on("message", message => onMediaMessage(message));
    }

    sendMediaMessage(message: SenderMediaMessage) {
        this.mediaChannel.send(message);
    }
}
