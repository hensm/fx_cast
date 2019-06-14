"use strict";

import { Options } from "../defaultOptions";
import cast, { init } from "../shim/export";


// Variables passed from background
const { srcUrl
      , targetElementId }
    : { srcUrl: string
      , targetElementId: number } = (window as any);


let options: Options;

let session: cast.Session;
let currentMedia: cast.media.Media;

let ignoreMediaEvents = false;


const isLocalFile = srcUrl.startsWith("file:");

const mediaElement = browser.menus.getTargetElement(
        targetElementId) as HTMLMediaElement;

window.addEventListener("beforeunload", () => {
    browser.runtime.sendMessage({
        subject: "bridge:/mediaServer/stop"
    });

    if (options.mediaStopOnUnload) {
        session.stop(null, null);
        /*currentMedia.stop(null
              , onMediaStopSuccess
              , onMediaStopError);*/
    }
});

function getLocalAddress () {
    const pc = new RTCPeerConnection();
    pc.createDataChannel(null);
    pc.createOffer().then(pc.setLocalDescription.bind(pc));

    return new Promise((resolve, reject) => {
        pc.addEventListener("icecandidate", ev => {
            if (ev.candidate) {
                resolve(ev.candidate.candidate.split(" ")[4]);
            }
        });
        pc.addEventListener("error", ev => {
            reject();
        });
    });
}


async function onRequestSessionSuccess (newSession: cast.Session) {
    cast.logMessage("onRequestSessionSuccess");

    session = newSession;

    let mediaUrl = new URL(srcUrl);
    const port = options.localMediaServerPort;

    if (isLocalFile) {
        await new Promise((resolve, reject) => {
            browser.runtime.sendMessage({
                subject: "bridge:/mediaServer/start"
              , data: {
                    filePath: decodeURI(mediaUrl.pathname)
                  , port
                }
            });

            browser.runtime.onMessage.addListener(function onMessage (message) {
                if (message.subject === "mediaCast:/mediaServer/started") {
                    browser.runtime.onMessage.removeListener(onMessage);
                    resolve();
                }
            });
        });

        // Address of local HTTP server
        mediaUrl = new URL(`http://${await getLocalAddress()}:${port}/`);
    }

    const mediaInfo = new cast.media.MediaInfo(mediaUrl.href, null);

    // Media metadata (title/poster)
    mediaInfo.metadata = new cast.media.GenericMediaMetadata();
    mediaInfo.metadata.metadataType = cast.media.MetadataType.GENERIC;
    mediaInfo.metadata.title = mediaUrl.pathname;

    if (mediaElement instanceof HTMLVideoElement && mediaElement.poster) {
        mediaInfo.metadata.images = [
            new cast.Image(mediaElement.poster)
        ];
    }


    const activeTrackIds = [];

    if (mediaElement.textTracks.length) {
        const trackElements = mediaElement.querySelectorAll("track");

        let index = 0;
        for (const textTrack of Array.from(mediaElement.textTracks)) {
            const trackElement = trackElements[index];

            // Create Track object
            const track = new cast.media.Track(
                    index                              // trackId
                  , cast.media.TrackType.TEXT); // trackType

            // Copy TextTrack properties to Track
            track.name = textTrack.label;
            track.language = textTrack.language;
            track.trackContentId = trackElement.src;
            track.trackContentType = "text/vtt";

            const { TextTrackType } = cast.media;

            switch (textTrack.kind) {
                case "subtitles":
                    track.subtype = TextTrackType.SUBTITLES;
                    break;
                case "captions":
                    track.subtype = TextTrackType.CAPTIONS;
                    break;
                case "descriptions":
                    track.subtype = TextTrackType.DESCRIPTIONS;
                    break;
                case "chapters":
                    track.subtype = TextTrackType.CHAPTERS;
                    break;
                case "metadata":
                    track.subtype = TextTrackType.METADATA;
                    break;

                // Default to subtitles
                default:
                    track.subtype = TextTrackType.SUBTITLES;
            }

            // Add track to mediaInfo
            mediaInfo.tracks.push(track);

            // If enabled, set as active track for load request
            if (textTrack.mode === "showing" || trackElement.default) {
                activeTrackIds.push(index);
            }

            index++;
        }
    }

    const loadRequest = new cast.media.LoadRequest(mediaInfo);
    loadRequest.autoplay = false;
    loadRequest.activeTrackIds = activeTrackIds;

    session.loadMedia(loadRequest
          , onLoadMediaSuccess
          , onLoadMediaError);
}

function onRequestSessionError () {
    cast.logMessage("onRequestSessionError");
}


function sessionListener (newSession: cast.Session) {
    cast.logMessage("sessionListener");
}

function receiverListener (availability: string) {
    cast.logMessage("receiverListener");

    if (availability === cast.ReceiverAvailability.AVAILABLE) {
        cast.requestSession(
                onRequestSessionSuccess
              , onRequestSessionError);
    }
}


function onInitializeSuccess () {
    cast.logMessage("onInitializeSuccess");
}

function onInitializeError () {
    cast.logMessage("onInitializeError");
}


function onLoadMediaSuccess (media: cast.media.Media) {
    cast.logMessage("onLoadMediaSuccess");

    currentMedia = media;

    if (options.mediaSyncElement) {
        mediaElement.addEventListener("play", () => {
            if (ignoreMediaEvents) {
                ignoreMediaEvents = false;
                return;
            }

            currentMedia.play(null
                  , onMediaPlaySuccess
                  , onMediaPlayError);
        });

        mediaElement.addEventListener("pause", () => {
            if (ignoreMediaEvents) {
                ignoreMediaEvents = false;
                return;
            }

            currentMedia.pause(null
                  , onMediaPauseSuccess
                  , onMediaPauseError);
        });

        mediaElement.addEventListener("suspend", () => {
            /*currentMedia.stop(null
                  , onMediaStopSuccess
                  , onMediaStopError);*/
        });

        mediaElement.addEventListener("seeking", () => {
            if (ignoreMediaEvents) {
                ignoreMediaEvents = false;
                return;
            }

            const seekRequest = new cast.media.SeekRequest();
            seekRequest.currentTime = mediaElement.currentTime;

            currentMedia.seek(seekRequest
                  , onMediaSeekSuccess
                  , onMediaSeekError);
        });

        mediaElement.addEventListener("ratechange", () => {
            (currentMedia as any)._sendMediaMessage({
                type: "SET_PLAYBACK_RATE"
              , playbackRate: mediaElement.playbackRate
            });
        });

        mediaElement.addEventListener("volumechange", () => {
            const newVolume = new cast.Volume(
                    currentMedia.volume.level
                  , currentMedia.volume.muted);

            const volumeRequest =
                    new cast.media.VolumeRequest(newVolume);

            cast.logMessage("Volume change");
            currentMedia.setVolume(volumeRequest);
        });


        currentMedia.addUpdateListener(isAlive => {
            if (!isAlive) {
                return;
            }

            // PlayerState
            const localPlayerState = mediaElement.paused
                ? cast.media.PlayerState.PAUSED
                : cast.media.PlayerState.PLAYING;

            if (localPlayerState !== currentMedia.playerState) {
                ignoreMediaEvents = true;
                switch (currentMedia.playerState) {
                    case cast.media.PlayerState.PLAYING:
                        mediaElement.play();
                        break;

                    case cast.media.PlayerState.PAUSED:
                        mediaElement.pause();
                        break;
                }
            }

            // RepeatMode
            const localRepeatMode = mediaElement.loop
                ? cast.media.RepeatMode.SINGLE
                : cast.media.RepeatMode.OFF;

            if (localRepeatMode !== currentMedia.repeatMode) {
                ignoreMediaEvents = true;
                switch (currentMedia.repeatMode) {
                    case cast.media.RepeatMode.SINGLE:
                        mediaElement.loop = true;
                        break;

                    case cast.media.RepeatMode.OFF:
                        mediaElement.loop = false;
                        break;
                }
            }


            // currentTime
            if (currentMedia.currentTime !== mediaElement.currentTime) {
                ignoreMediaEvents = true;
                mediaElement.currentTime = currentMedia.currentTime;
            }
        });
    }
}

function onLoadMediaError () {
    cast.logMessage("onLoadMediaError");
}


/* play */
function onMediaPlaySuccess () {
    cast.logMessage("onMediaPlaySuccess");
}

function onMediaPlayError (err: cast.Error) {
    cast.logMessage("onMediaPlayError");
}


/* pause */
function onMediaPauseSuccess () {
    cast.logMessage("onMediaPauseSuccess");
}

function onMediaPauseError (err: cast.Error) {
    cast.logMessage("onMediaPauseError");
}


/* stop */
function onMediaStopSuccess () {
    cast.logMessage("onMediaStopSuccess");
}

function onMediaStopError (err: cast.Error) {
    cast.logMessage("onMediaStopError");
}


/* seek */
function onMediaSeekSuccess () {
    cast.logMessage("onMediaSeekSuccess");
}

function onMediaSeekError (err: cast.Error) {
    cast.logMessage("onMediaSeekError");
}


init().then(async bridgeInfo => {
    if (!bridgeInfo.isVersionCompatible) {
        console.error("__onGCastApiAvailable error");
        return;
    }

    options = (await browser.storage.sync.get("options")).options;

    if (isLocalFile && !options.localMediaEnabled) {
        cast.logMessage("Local media casting not enabled");
        return;
    }


    const sessionRequest = new cast.SessionRequest(
            cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);

    const apiConfig = new cast.ApiConfig(sessionRequest
          , sessionListener
          , receiverListener);

    cast.initialize(apiConfig
          , onInitializeSuccess
          , onInitializeError);
});
