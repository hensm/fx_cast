import options from "../../lib/options";
import { Logger } from "../../lib/logger";

import type { ReceiverDevice } from "../../types";

import type { ReceiverAvailability } from "../sdk/enums";
import type Session from "../sdk/Session";

import cast, { ensureInit } from "../export";

const logger = new Logger("fx_cast [mirroring sender]");

const NS_FX_CAST = "urn:x-cast:fx_cast";

type MirroringAppMessage =
    | { subject: "peerConnectionOffer"; data: RTCSessionDescriptionInit }
    | { subject: "peerConnectionAnswer"; data: RTCSessionDescriptionInit }
    | { subject: "iceCandidate"; data: RTCIceCandidateInit }
    | { subject: "close" };

interface MirroringSenderOpts {
    contextTabId?: number;
    receiverDevice?: ReceiverDevice;
}

class MirroringSender {
    private contextTabId?: number;
    private receiverDevice?: ReceiverDevice;

    private session?: Session;
    private wasSessionRequested = false;

    private peerConnection?: RTCPeerConnection;

    constructor(opts: MirroringSenderOpts) {
        this.contextTabId = opts.contextTabId;
        this.receiverDevice = opts.receiverDevice;

        this.init();
    }

    private async init() {
        try {
            await ensureInit({
                contextTabId: this.contextTabId,
                receiverDevice: this.receiverDevice
            });
        } catch (err) {
            logger.error("Failed to initialize cast API", err);
        }

        const mirroringAppId = await options.get("mirroringAppId");
        const sessionRequest = new cast.SessionRequest(mirroringAppId);

        const apiConfig = new cast.ApiConfig(
            sessionRequest,
            this.sessionListener,
            this.receiverListener
        );

        cast.initialize(apiConfig);
    }

    private sessionListener() {
        // Unused
    }
    private receiverListener = (availability: ReceiverAvailability) => {
        if (this.wasSessionRequested) return;
        this.wasSessionRequested = true;

        if (availability === cast.ReceiverAvailability.AVAILABLE) {
            cast.requestSession(
                session => {
                    this.session = session;
                    this.createMirroringConnection();
                },
                err => {
                    logger.error("Session request failed", err);
                }
            );
        }
    };

    private sendMirroringAppMessage(message: MirroringAppMessage) {
        if (!this.session) return;
        this.session.sendMessage(NS_FX_CAST, message);
    }

    private async createMirroringConnection() {
        this.session?.addMessageListener(NS_FX_CAST, async (_ns, message) => {
            const parsedMessage = JSON.parse(message) as MirroringAppMessage;
            switch (parsedMessage.subject) {
                case "peerConnectionAnswer":
                    this.peerConnection?.setRemoteDescription(
                        parsedMessage.data
                    );
                    break;
                case "iceCandidate":
                    this.peerConnection?.addIceCandidate(parsedMessage.data);
                    break;
            }
        });

        this.peerConnection = new RTCPeerConnection();

        this.peerConnection.addEventListener("negotiationneeded", async () => {
            if (!this.peerConnection) return;

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.sendMirroringAppMessage({
                subject: "peerConnectionOffer",
                data: offer
            });
        });

        this.peerConnection.addEventListener("icecandidate", ev => {
            if (!ev.candidate) return;
            this.sendMirroringAppMessage({
                subject: "iceCandidate",
                data: ev.candidate
            });
        });

        try {
            // Add screen media stream
            this.peerConnection.addStream(
                await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: "motion" },
                    audio: false
                })
            );
        } catch (err) {
            logger.error("Failed to add display media stream!", err);
            this.peerConnection.close();
            this.session?.stop();
        }
    }
}

/**
 * If loaded as a content script, opts are stored on the window object.
 */
if (window.location.protocol !== "moz-extension:") {
    const window_ = window as any;

    new MirroringSender({
        contextTabId: window_.contextTabId,
        receiverDevice: window_.receiverDevice
    });
}
