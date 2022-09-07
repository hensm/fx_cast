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

    private peerConnection: Optional<RTCPeerConnection>;

    // Stream opts
    private streamMaxFrameRate = 1;
    private streamMaxBitRate = 1;
    private streamDownscaleFactor = 1;
    private streamUseMaxResolution = false;
    private streamMaxResolution: { width?: number; height?: number } = {};

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

        const {
            mirroringAppId,
            mirroringStreamMaxFrameRate,
            mirroringStreamMaxBitRate,
            mirroringStreamDownscaleFactor,
            mirroringStreamUseMaxResolution,
            mirroringStreamMaxResolution
        } = await options.getAll();

        this.streamMaxFrameRate = mirroringStreamMaxFrameRate;
        this.streamMaxBitRate = mirroringStreamMaxBitRate;
        this.streamDownscaleFactor = mirroringStreamDownscaleFactor;
        this.streamUseMaxResolution = mirroringStreamUseMaxResolution;
        this.streamMaxResolution = mirroringStreamMaxResolution;

        const sessionRequest = new cast.SessionRequest(mirroringAppId);

        const apiConfig = new cast.ApiConfig(
            sessionRequest,
            this.sessionListener,
            this.receiverListener
        );

        cast.initialize(apiConfig);
    }

    stop() {
        this.peerConnection?.close();
        this.session?.stop();
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
        const pc = new RTCPeerConnection();
        this.peerConnection = pc;

        this.session?.addMessageListener(NS_FX_CAST, async (_ns, message) => {
            const parsedMessage = JSON.parse(message) as MirroringAppMessage;
            switch (parsedMessage.subject) {
                case "peerConnectionAnswer":
                    pc.setRemoteDescription(parsedMessage.data);
                    break;
                case "iceCandidate":
                    pc.addIceCandidate(parsedMessage.data);
                    break;
            }
        });

        pc.addEventListener("negotiationneeded", async () => {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            this.sendMirroringAppMessage({
                subject: "peerConnectionOffer",
                data: offer
            });
        });

        pc.addEventListener("icecandidate", ev => {
            if (!ev.candidate) return;
            this.sendMirroringAppMessage({
                subject: "iceCandidate",
                data: ev.candidate
            });
        });

        // Connection listener
        pc.addEventListener("iceconnectionstatechange", async () => {
            if (pc.iceConnectionState !== "connected") {
                return;
            }

            applyParameters();
        });

        /** Applies stream encoding parameters.  */
        const applyParameters = async () => {
            // Set stream encoding parameters
            const [sender] = pc.getSenders();
            const params = sender.getParameters();
            if (!params.encodings) {
                params.encodings = [{}];
            }

            const [encoding] = params.encodings;

            if (!(encoding as any).maxFramerate) {
                (encoding as any).maxFramerate = this.streamMaxFrameRate;
            }
            if (!encoding.maxBitrate) {
                encoding.maxBitrate = this.streamMaxBitRate;
            }

            encoding.scaleResolutionDownBy = this.streamDownscaleFactor;

            // Handle limiting stream resolution
            if (this.streamUseMaxResolution) {
                const { width: trackWidth, height: trackHeight } =
                    sender.track?.getSettings() ?? {};

                // Calculate downscale ratios for width/height
                let widthRatio = 1;
                let heightRatio = 1;
                if (trackWidth && this.streamMaxResolution.width) {
                    widthRatio = trackWidth / this.streamMaxResolution.width;
                }
                if (trackHeight && this.streamMaxResolution.height) {
                    heightRatio = trackHeight / this.streamMaxResolution.height;
                }

                // Use the largest ratio to ensure below resolution limit
                const downscaleRatio = Math.max(1, widthRatio, heightRatio);

                // Multiply existing downscale
                encoding.scaleResolutionDownBy *= downscaleRatio;
            }

            await sender.setParameters(params);
        };

        let stream: MediaStream;
        try {
            // Add screen media stream

            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "motion",
                    frameRate: this.streamMaxFrameRate
                },
                audio: false
            });

            const [track] = stream.getVideoTracks();
            pc.addTrack(track, stream);
            track.addEventListener("ended", () => this.stop());
        } catch (err) {
            logger.error("Failed to add display media stream!", err);
            this.stop();
            return;
        }

        /**
         * Use a video element to get stream resize events and update
         * scaling parameters.
         */
        const video = document.createElement("video");
        video.srcObject = stream;
        video.addEventListener("resize", () => applyParameters());
        video.play();
    }
}

/**
 * If loaded as a content script, opts are stored on the window object.
 */
if (window.location.protocol !== "moz-extension:") {
    const window_ = window as any;

    const sender = new MirroringSender({
        contextTabId: window_.contextTabId,
        receiverDevice: window_.receiverDevice
    });

    window.addEventListener("beforeunload", () => {
        sender.stop();
    });
}
