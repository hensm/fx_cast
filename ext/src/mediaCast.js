"use strict";

let options;

let chrome;
let logMessage;


let session;
let currentMedia;


const isLocalFile = srcUrl.startsWith("file:");

const mediaElement = isLocalFile
    ? document.querySelector("video, audio")
    : document.querySelector(`[src="${srcUrl}"]`);

window.addEventListener("beforeunload", () => {
    browser.runtime.sendMessage({
        subject: "bridge:stopHttpServer"
    });
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

// TODO: Fix this broken mess
let ignoreMediaEvents = false;
function silent (fn) {
    ignoreMediaEvents = true;
    fn();
}

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
    if (ignoreMediaEvents) return;

    /*currentMedia.stop(null
          , onMediaStopSuccess
          , onMediaStopError);*/
});

mediaElement.addEventListener("seeking", () => {
    if (ignoreMediaEvents) {
        ignoreMediaEvents = false;
        return;
    }

    const seekRequest = new chrome.cast.media.SeekRequest();
    seekRequest.currentTime = mediaElement.currentTime;

    currentMedia.seek(seekRequest
          , onMediaSeekSuccess
          , onMediaSeekError);
});

mediaElement.addEventListener("ratechange", () => {
    if (ignoreMediaEvents) {
        ignoreMediaEvents = false;
        return;
    }

    currentMedia._sendMediaMessage({
        type: "SET_PLAYBACK_RATE"
      , playbackRate: mediaElement.playbackRate
    });
});

mediaElement.addEventListener("volumechange", () => {
    if (ignoreMediaEvents) {
        ignoreMediaEvents = false;
        return;
    }

    const newVolume = new chrome.cast.Volume(
            currentMedia.volume
          , currentMedia.muted);
    const volumeRequest = new chrome.cast.media.VolumeRequest(newVolume);

    logMessage("Volume change");
    currentMedia.setVolume(volumeRequest);
});


async function onRequestSessionSuccess (session_) {
    logMessage("onRequestSessionSuccess");

    session = session_;

    let mediaUrl = new URL(srcUrl);
    const port = options.option_localMediaServerPort;

    if (isLocalFile) {
        await new Promise((resolve, reject) => {
            browser.runtime.sendMessage({
                subject: "bridge:startHttpServer"
              , data: {
                    filePath: decodeURI(mediaUrl.pathname)
                  , port
                }
            });

            browser.runtime.onMessage.addListener(function onMessage (message) {
                if (message.subject === "mediaCast:httpServerStarted") {
                    browser.runtime.onMessage.removeListener(onMessage);
                    resolve();
                }
            });
        });

        // Address of local HTTP server
        mediaUrl = new URL(`http://${await getLocalAddress()}:${port}/`);
    }

    const mediaInfo = new chrome.cast.media.MediaInfo(mediaUrl.href);

    // Media metadata (title/poster)
    mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
    mediaInfo.metadata.title = mediaUrl.pathname;

    if (mediaElement.poster) {
        mediaInfo.metadata.images = [
            new chrome.cast.Image(mediaElement.poster)
        ];
    }

    const loadRequest = new chrome.cast.media.LoadRequest(mediaInfo);
    loadRequest.autoplay = false;

    session.loadMedia(loadRequest
          , onLoadMediaSuccess
          , onLoadMediaError);
}
function onRequestSessionError () {
    logMessage("onRequestSessionError");
}

function sessionListener (session) {
    logMessage("sessionListener");
}
function receiverListener (availability) {
    logMessage("receiverListener");

    if (availability === chrome.cast.ReceiverAvailability.AVAILABLE) {
        chrome.cast.requestSession(
                onRequestSessionSuccess
              , onRequestSessionError);
    }
}

function onInitializeSuccess () {
    logMessage("onInitializeSuccess");
}
function onInitializeError () {
    logMessage("onInitializeError");
}

function onLoadMediaSuccess (media) {
    logMessage("onLoadMediaSuccess");

    currentMedia = media;
    currentMedia.addUpdateListener(() => {
        console.log(currentMedia);

        // PlayerState
        const localPlayerState = mediaElement.paused
            ? chrome.cast.media.PlayerState.PAUSED
            : chrome.cast.media.PlayerState.PLAYING;

        if (localPlayerState !== currentMedia.playerState) {
            switch (currentMedia.playerState) {
                case chrome.cast.media.PlayerState.PLAYING:
                    silent(() => {
                        mediaElement.play();
                    });
                    break;

                case chrome.cast.media.PlayerState.PAUSED:
                    silent(() => {
                        mediaElement.pause();
                    });
                    break;
            }
        }

        // RepeatMode
        const localRepeatMode  = mediaElement.loop
            ? chrome.cast.media.RepeatMode.SINGLE
            : chrome.cast.media.RepeatMode.OFF;

        if (localRepeatMode !== currentMedia.repeatMode) {
            switch (currentMedia.repeatMode) {
                case chrome.cast.media.RepeatMode.SINGLE:
                    mediaElement.loop = true;
                    break;

                case chrome.cast.media.RepeatMode.OFF:
                    mediaElement.loop = false;
                    break;
            }
        }


        // currentTime
        if (currentMedia.currentTime !== mediaElement.currentTime) {
            silent(() => {
                mediaElement.currentTime = currentMedia.currentTime;
            });
        }
    });
}
function onLoadMediaError () {
    logMessage("onLoadMediaError");
}

/* play */
function onMediaPlaySuccess () {
    logMessage("onMediaPlaySuccess");
}
function onMediaPlayError (err) {
    logMessage("onMediaPlayError");
}

/* pause */
function onMediaPauseSuccess () {
    logMessage("onMediaPauseSuccess");
}
function onMediaPauseError (err) {
    logMessage("onMediaPauseError");
}

/* stop */
function onMediaStopSuccess () {
    logMessage("onMediaStopSuccess");
}
function onMediaStopError (err) {
    logMessage("onMediaStopError");
}

/* seek */
function onMediaSeekSuccess () {
    logMessage("onMediaSeekSuccess");
}
function onMediaSeekError (err) {
    logMessage("onMediaSeekError");
}


window.__onGCastApiAvailable = async function (loaded, errorInfo) {
    if (!loaded) {
        logMessage("__onGCastApiAvailable error");
        return;
    }

    chrome = window.chrome;
    logMessage = chrome.cast.logMessage;

    logMessage("__onGCastApiAvailable success");


    options = (await browser.storage.sync.get("options")).options;

    if (isLocalFile && !options.option_localMediaEnabled) {
        logMessage("Local media casting not enabled");
        return;
    }


    const sessionRequest = new chrome.cast.SessionRequest(
            chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);

    const apiConfig = new chrome.cast.ApiConfig(sessionRequest
          , sessionListener
          , receiverListener);

    chrome.cast.initialize(apiConfig
          , onInitializeSuccess
          , onInitializeError);
};
