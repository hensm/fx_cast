"use strict";

import mediaCasting from "../lib/mediaCasting";
import options from "../lib/options";
import cast, { ensureInit } from "../shim/export";

import { Message, Receiver } from "../types";


// Variables passed from background
const { selectedReceiver
      , srcUrl
      , targetElementId }
    : { selectedReceiver: Receiver
      , srcUrl: string
      , targetElementId: number } = (window as any);


let backgroundPort: browser.runtime.Port;

let session: cast.Session;
let currentMedia: cast.media.Media;

let ignoreMediaEvents = false;


const isLocalFile = srcUrl.startsWith("file:");

const mediaElement = browser.menus.getTargetElement(
        targetElementId) as HTMLMediaElement;

window.addEventListener("beforeunload", async () => {
    backgroundPort.postMessage({
        subject: "bridge:/mediaServer/stop"
    });

    if (await options.get("mediaStopOnUnload")) {
        session.stop(null, null);
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


function startMediaServer (filePath: string, port: number) {
    return new Promise((resolve, reject) => {
        backgroundPort.postMessage({
            subject: "bridge:/mediaServer/start"
          , data: {
                filePath: decodeURI(filePath)
              , port
            }
        });

        backgroundPort.onMessage.addListener(
                function onMessage (message: Message) {

            switch (message.subject) {
                case "mediaCast:/mediaServer/started": {
                    backgroundPort.onMessage.removeListener(onMessage);
                    resolve();
                }
                case "mediaCast:/mediaServer/error": {
                    backgroundPort.onMessage.removeListener(onMessage);
                    reject();
                }
            }
        });
    });
}

async function loadMedia () {
    let mediaUrl = new URL(srcUrl);
    const mediaTitle = mediaUrl.pathname;

    /**
     * If the media is a local file, start an HTTP media server
     * and change the media URL to point to it.
     */
    if (isLocalFile) {
        const host = await getLocalAddress();
        const port = await options.get("localMediaServerPort");

        try {
            // Wait until media server is listening
            await startMediaServer(mediaUrl.pathname, port);
        } catch (err) {
            console.error("Failed to start media server");
            return;
        }

        mediaUrl = new URL(`http://${host}:${port}/`);
    }


    const mediaInfo = new cast.media.MediaInfo(mediaUrl.href, null);

    // Media metadata (title/poster)
    mediaInfo.metadata = new cast.media.GenericMediaMetadata();
    mediaInfo.metadata.metadataType = cast.media.MetadataType.GENERIC;
    mediaInfo.metadata.title = mediaTitle;

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


async function onLoadMediaSuccess (media: cast.media.Media) {
    cast.logMessage("onLoadMediaSuccess");

    currentMedia = media;

    if (await options.get("mediaSyncElement")) {
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

function onRequestSessionError () {
    cast.logMessage("onRequestSessionError");
}
function sessionListener (newSession: cast.Session) {
    cast.logMessage("sessionListener");
}
function onInitializeSuccess () {
    cast.logMessage("onInitializeSuccess");
}
function onInitializeError () {
    cast.logMessage("onInitializeError");
}
function onLoadMediaError () {
    cast.logMessage("onLoadMediaError");
}
function onMediaPlaySuccess () {
    cast.logMessage("onMediaPlaySuccess");
}
function onMediaPlayError (err: cast.Error) {
    cast.logMessage("onMediaPlayError");
}
function onMediaPauseSuccess () {
    cast.logMessage("onMediaPauseSuccess");
}
function onMediaPauseError (err: cast.Error) {
    cast.logMessage("onMediaPauseError");
}
function onMediaStopSuccess () {
    cast.logMessage("onMediaStopSuccess");
}
function onMediaStopError (err: cast.Error) {
    cast.logMessage("onMediaStopError");
}
function onMediaSeekSuccess () {
    cast.logMessage("onMediaSeekSuccess");
}
function onMediaSeekError (err: cast.Error) {
    cast.logMessage("onMediaSeekError");
}


ensureInit().then(async (port) => {
    backgroundPort = port;

    const isLocalMediaEnabled = await options.get("localMediaEnabled");
    if (isLocalFile && !isLocalMediaEnabled) {
        cast.logMessage("Local media casting not enabled");
        return;
    }

    session = await mediaCasting.getMediaSession(selectedReceiver);

    loadMedia();
});
