import { Logger } from "../../lib/logger";
import options from "../../lib/options";

import type { Message } from "../../messaging";

// Cast types
import type { ReceiverAvailability } from "../sdk/enums";
import type Session from "../sdk/Session";
import type Media from "../sdk/media/Media";

import cast, { ensureInit, CastPort } from "../export";

const logger = new Logger("fx_cast [media sender]");

interface MediaSenderOpts {
    mediaUrl: string;
    contextTabId?: number;
    mediaElement?: HTMLMediaElement;
}

export default class MediaSender {
    private port?: CastPort;

    private mediaUrl: string;
    private contextTabId?: number;

    /** Target media element if loaded as a content script. */
    private mediaElement?: HTMLMediaElement;

    private isLocalMedia = false;
    private isLocalMediaEnabled = false;

    private wasSessionRequested = false;

    // Cast API objects
    private session?: Session;
    private media?: Media;

    constructor(opts: MediaSenderOpts) {
        this.mediaUrl = opts.mediaUrl;
        this.contextTabId = opts.contextTabId;
        this.mediaElement = opts.mediaElement;

        this.init();
    }

    stop() {
        this.port?.postMessage({ subject: "bridge:stopMediaServer" });
        this.session?.stop();
    }

    private async init() {
        try {
            this.port = await ensureInit({ contextTabId: this.contextTabId });
        } catch (err) {
            logger.error("Failed to initialize cast API", err);
        }

        window.addEventListener("beforeunload", async () => {
            if (await options.get("mediaStopOnUnload")) {
                this.port?.postMessage({
                    subject: "bridge:stopMediaServer"
                });

                this.session?.stop();
            }
        });

        this.isLocalMedia = this.mediaUrl.startsWith("file://");
        this.isLocalMediaEnabled = await options.get("localMediaEnabled");

        if (this.isLocalMedia && !this.isLocalMediaEnabled) {
            throw logger.error("Local media casting not enabled");
        }

        const capabilities = [cast.Capability.AUDIO_OUT];
        if (this.mediaElement instanceof HTMLVideoElement) {
            capabilities.push(cast.Capability.VIDEO_OUT);
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
                logger.error("Failed to initialize cast SDK", err);
            }
        );
    }

    private sessionListener() {
        // Unused
    }
    private receiverListener(availability: ReceiverAvailability) {
        if (this.wasSessionRequested) return;
        this.wasSessionRequested = false;

        if (availability === cast.ReceiverAvailability.AVAILABLE) {
            cast.requestSession(
                session => {
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
        mediaInfo.tracks = [];

        const activeTrackIds: number[] = [];

        let trackIndex = 0;
        for (const url of subtitleUrls) {
            const track = new cast.media.Track(
                trackIndex++,
                cast.media.TrackType.TEXT
            );
            track.name = url.pathname;
            track.trackContentId = url.href;
            track.trackContentType = "text/vtt";
            track.subtype = cast.media.TextTrackType.SUBTITLES;

            mediaInfo.tracks.push(track);
        }

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

        this.session?.loadMedia(loadRequest, async media => {
            this.media = media;

            if (
                (await options.get("mediaSyncElement")) &&
                this.mediaElement instanceof HTMLMediaElement
            ) {
                this.addMediaElementListeners(this.mediaElement);
            }
        });
    }

    private addMediaElementListeners(mediaElement: HTMLMediaElement) {
        this.session?.addUpdateListener(isAlive => {
            if (!isAlive) return;

            // Update volume level
            const volume = this.session?.receiver.volume;
            if (!volume) return;

            if (
                volume?.level !== null &&
                volume.level !== mediaElement.volume
            ) {
                mediaElement.volume = volume.level;
            }
            // Update muted state
            if (volume?.muted !== null && volume.muted !== mediaElement.muted) {
                mediaElement.muted = volume.muted;
            }
        });

        this.media?.addUpdateListener(isAlive => {
            if (!isAlive || !this.media) return;

            /**
             * If media element time and estimated time are off by more
             * than two seconds, set the media element time to the
             * estimated time.
             */
            const estimatedTime = this.media.getEstimatedTime();
            if (Math.abs(mediaElement.currentTime - estimatedTime) > 2) {
                mediaElement.currentTime = estimatedTime;
            }

            const mediaElementPlayerState = mediaElement.paused
                ? cast.media.PlayerState.PAUSED
                : cast.media.PlayerState.PLAYING;

            if (mediaElementPlayerState !== this.media.playerState) {
                switch (this.media.playerState) {
                    case cast.media.PlayerState.PLAYING:
                        mediaElement.play();
                        break;
                    case cast.media.PlayerState.PAUSED:
                    case cast.media.PlayerState.BUFFERING:
                    case cast.media.PlayerState.IDLE:
                        mediaElement.pause();
                        break;
                }
            }
        });
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

/**
 * If loaded as a content script, opts are stored on the window object.
 */
if (window.location.protocol !== "moz-extension:") {
    const window_ = window as any;

    let mediaElement: Optional<HTMLMediaElement>;
    if (window_.targetElementId) {
        mediaElement = browser.menus.getTargetElement(
            window_.targetElementId
        ) as HTMLMediaElement;
    }

    new MediaSender({
        mediaUrl: window_.mediaUrl,
        mediaElement
    });
}
