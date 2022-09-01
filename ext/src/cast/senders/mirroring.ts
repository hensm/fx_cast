"use strict";

import options from "../../lib/options";
import { Logger } from "../../lib/logger";

import { ReceiverDevice, ReceiverSelectorMediaType } from "../../types";

import type Session from "../sdk/Session";
import cast, { ensureInit } from "../export";
import type { ReceiverAvailability } from "../sdk/enums";

const logger = new Logger("fx_cast [mirroring sender]");

const NS_FX_CAST = "urn:x-cast:fx_cast";

type MirroringAppMessage =
    | { subject: "peerConnectionOffer"; data: RTCSessionDescriptionInit }
    | { subject: "peerConnectionAnswer"; data: RTCSessionDescriptionInit }
    | { subject: "iceCandidate"; data: RTCIceCandidateInit }
    | { subject: "close" };

type MirroringMediaType =
    | ReceiverSelectorMediaType.Tab
    | ReceiverSelectorMediaType.Screen;

interface MirroringSenderOpts {
    mirroringMediaType: MirroringMediaType;
    contextTabId?: number;
    receiverDevice?: ReceiverDevice;
}

class MirroringSender {
    private mirroringMediaType: MirroringMediaType;
    private contextTabId?: number;
    private receiverDevice?: ReceiverDevice;

    private session?: Session;
    private wasSessionRequested = false;

    private peerConnection?: RTCPeerConnection;

    constructor(opts: MirroringSenderOpts) {
        this.mirroringMediaType = opts.mirroringMediaType;
        this.contextTabId = opts.contextTabId;
        this.receiverDevice = opts.receiverDevice;

        this.init();
    }

    private async init() {
        try {
            ensureInit({
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
        this.peerConnection.addEventListener("icecandidate", ev => {
            if (!ev.candidate) return;
            this.sendMirroringAppMessage({
                subject: "iceCandidate",
                data: ev.candidate
            });
        });

        switch (this.mirroringMediaType) {
            case ReceiverSelectorMediaType.Tab:
                this.peerConnection.addStream(this.getTabStream());
                break;
            case ReceiverSelectorMediaType.Screen:
                this.peerConnection.addStream(await this.getScreenStream());
                break;
        }

        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        this.sendMirroringAppMessage({
            subject: "peerConnectionOffer",
            data: offer
        });
    }

    private getTabStream() {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw logger.error("Failed to get tab canvas context!");
        }

        // Set initial size
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        // Resize canvas whenever the window resizes
        window.addEventListener("resize", () => {
            canvas.width = window.innerWidth * window.devicePixelRatio;
            canvas.height = window.innerHeight * window.devicePixelRatio;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        });

        const drawFlags =
            ctx.DRAWWINDOW_DRAW_CARET |
            ctx.DRAWWINDOW_DRAW_VIEW |
            ctx.DRAWWINDOW_ASYNC_DECODE_IMAGES |
            ctx.DRAWWINDOW_USE_WIDGET_LAYERS;

        let lastFrame: DOMHighResTimeStamp;
        window.requestAnimationFrame(function draw(now: DOMHighResTimeStamp) {
            if (!lastFrame) {
                lastFrame = now;
            }

            if (now - lastFrame > 1000 / 30) {
                ctx.drawWindow(
                    window, // window
                    0,
                    0, // x, y
                    canvas.width, // w
                    canvas.height, // h
                    "white", // bgColor
                    drawFlags
                ); // flags

                lastFrame = now;
            }

            window.requestAnimationFrame(draw);
        });

        return canvas.captureStream();
    }

    private getScreenStream() {
        return new Promise<MediaStream>(resolve => {
            window.addEventListener(
                "click",
                () => {
                    resolve(
                        navigator.mediaDevices.getDisplayMedia({
                            video: { cursor: "motion" },
                            audio: false
                        })
                    );
                },
                { once: true }
            );
        });
    }
}

/**
 * If loaded as a content script, opts are stored on the window object.
 */
if (window.location.protocol !== "moz-extension:") {
    const window_ = window as any;

    new MirroringSender({
        mirroringMediaType: window_.mirroringMediaType,
        contextTabId: window_.contextTabId,
        receiverDevice: window_.receiverDevice
    });
}
