import { Logger } from "../../lib/logger";
import options from "../../lib/options";

import type { Message } from "../../messaging";

// Cast types
import { Capability, ReceiverAvailability } from "../sdk/enums";
import type Session from "../sdk/Session";

import cast, { ensureInit, CastPort } from "../export";

const logger = new Logger("fx_cast [media sender]");

interface MediaSenderOpts {
    mediaUrl: string;
    contextTabId?: number;
    targetElementId?: number;
}

export default class MediaSender {
    private port?: CastPort;

    private mediaUrl: string;
    private contextTabId?: number;

    private mediaElement?: HTMLMediaElement;

    private isLocalMedia = false;
    private isLocalMediaEnabled = false;

    // Cast API objects
    private session?: Session;

    constructor(opts: MediaSenderOpts) {
        this.mediaUrl = opts.mediaUrl;
        this.contextTabId = opts.contextTabId;

        if (opts.targetElementId) {
            this.mediaElement = browser.menus.getTargetElement(
                opts.targetElementId
            ) as HTMLMediaElement;
        }

        this.init();
    }

    stop() {
        this.port?.postMessage({ subject: "bridge:stopMediaServer" });
        this.session?.stop();
    }

    private async init() {
        try {
            this.port = await ensureInit(this.contextTabId);
        } catch (err) {
            logger.error("Failed to initialize cast API", err);
        }

        this.isLocalMedia = this.mediaUrl.startsWith("file://");
        this.isLocalMediaEnabled = await options.get("localMediaEnabled");

        if (this.isLocalMedia && !this.isLocalMediaEnabled) {
            throw logger.error("Local media casting not enabled");
        }

        const capabilities = [Capability.AUDIO_OUT];
        if (this.mediaElement instanceof HTMLVideoElement) {
            capabilities.push(Capability.VIDEO_OUT);
        }

        cast.initialize(
            new cast.ApiConfig(
                new cast.SessionRequest(
                    cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
                    capabilities
                ),
                this.sessionListener.bind(this),
                this.receiverListener.bind(this)
            ),
            undefined,
            err => {
                logger.error("Failed to initialize cast API", err);
            }
        );
    }

    private sessionListener() {
        // Unused
    }
    private receiverListener(availability: ReceiverAvailability) {
        // Already have session
        if (this.session) return;

        if (availability === cast.ReceiverAvailability.AVAILABLE) {
            cast.requestSession(
                (session: Session) => {
                    this.session = session;
                    this.loadMedia();
                },
                err => {
                    logger.error("Session request failed", err);
                }
            );
        }
    }

    private async loadMedia() {
        let mediaUrl = new URL(this.mediaUrl);
        const mediaTitle = mediaUrl.pathname.slice(1);
        const subtitleUrls: URL[] = [];

        if (this.isLocalMedia) {
            const port = await options.get("localMediaServerPort");
            try {
                const { localAddress, mediaPath, subtitlePaths } =
                    await this.startMediaServer(mediaTitle, port);

                const baseUrl = new URL(`http://${localAddress}:${port}/`);
                mediaUrl = new URL(mediaPath, baseUrl);
                subtitleUrls.push(
                    ...subtitlePaths.map(path => new URL(path, baseUrl))
                );
            } catch (err) {
                throw logger.error("Failed to start media server", err);
            }
        }

        const mediaInfo = new cast.media.MediaInfo(mediaUrl.href, "");
        mediaInfo.metadata = new cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = mediaTitle;

        const activeTrackIds: number[] = [];

        mediaInfo.tracks = subtitleUrls.map((url, index) => {
            const track = new cast.media.Track(
                index,
                cast.media.TrackType.TEXT
            );
            track.name = url.pathname;
            track.trackContentId = url.href;
            track.trackContentType = "text/vtt";
            track.subtype = cast.media.TextTrackType.SUBTITLES;

            return track;
        });

        if (this.mediaElement instanceof HTMLMediaElement) {
            if (this.mediaElement instanceof HTMLVideoElement) {
                if (this.mediaElement.poster) {
                    mediaInfo.metadata.images = [
                        new cast.Image(this.mediaElement.poster)
                    ];
                }
            }

            if (this.mediaElement.textTracks.length) {
                const textTracks = Array.from(this.mediaElement.textTracks);
                const trackElements =
                    this.mediaElement.querySelectorAll("track");

                let mediaTrackIndex = mediaInfo.tracks.length;
                textTracks.forEach((track, index) => {
                    const trackElement = trackElements[index];

                    /**
                     * Create media.Track object with the index as the track ID
                     * and type as TrackType.TEXT.
                     */
                    const castTrack = new cast.media.Track(
                        mediaTrackIndex,
                        cast.media.TrackType.TEXT
                    );

                    // Copy TextTrack properties
                    castTrack.name = track.label || `track-${mediaTrackIndex}`;
                    castTrack.language = track.language;
                    castTrack.trackContentId = trackElement.src;
                    castTrack.trackContentType = "text/vtt";

                    switch (track.kind) {
                        case "subtitles":
                            castTrack.subtype =
                                cast.media.TextTrackType.SUBTITLES;
                            break;
                        case "captions":
                            castTrack.subtype =
                                cast.media.TextTrackType.CAPTIONS;
                            break;
                        case "descriptions":
                            castTrack.subtype =
                                cast.media.TextTrackType.DESCRIPTIONS;
                            break;
                        case "chapters":
                            castTrack.subtype =
                                cast.media.TextTrackType.CHAPTERS;
                            break;
                        case "metadata":
                            castTrack.subtype =
                                cast.media.TextTrackType.METADATA;
                            break;

                        // Default to subtitles
                        default:
                            castTrack.subtype =
                                cast.media.TextTrackType.SUBTITLES;
                    }

                    // Add track to mediaInfo
                    mediaInfo.tracks?.push(castTrack);

                    // If enabled, mark as active track for load request
                    if (track.mode === "showing" || trackElement.default) {
                        activeTrackIds.push(mediaTrackIndex);
                    }

                    mediaTrackIndex++;
                });
            }
        }

        const loadRequest = new cast.media.LoadRequest(mediaInfo);
        loadRequest.autoplay = true;
        loadRequest.activeTrackIds = activeTrackIds;

        this.session?.loadMedia(loadRequest);
    }

    private startMediaServer(
        filePath: string,
        port: number
    ): Promise<{
        mediaPath: string;
        subtitlePaths: string[];
        localAddress: string;
    }> {
        return new Promise((resolve, reject) => {
            if (!this.port) {
                reject();
                return;
            }

            this.port.postMessage({
                subject: "bridge:startMediaServer",
                data: {
                    filePath: decodeURI(filePath),
                    port: port
                }
            });

            const onMessage = (ev: MessageEvent<Message>) => {
                const message = ev.data;

                if (message.subject.startsWith("mediaCast:mediaServer")) {
                    this.port?.removeEventListener("message", onMessage);
                }

                switch (message.subject) {
                    case "mediaCast:mediaServerStarted":
                        resolve(message.data);
                        break;
                    case "mediaCast:mediaServerError":
                        reject(message.data);
                        break;
                }
            };

            this.port.addEventListener("message", onMessage);
            this.port.start();
        });
    }
}

if (window.location.protocol !== "moz-extension:") {
    const window_ = window as any;
    new MediaSender({
        mediaUrl: window_.mediaUrl,
        targetElementId: window_.targetElementId
    });
}
