"use strict";

import cast, { ensureInit } from "../shim/export";
import options from "./options";

import { Receiver } from "../types";


function getMediaSession (
        receiver?: Receiver): Promise<cast.Session> {

    return new Promise(async (resolve, reject) => {
        await ensureInit();

        /**
         * If a receiver is available, call requestSession. If a
         * specific receiver was specified, bypass receiver selector
         * and create session directly.
         */
        function receiverListener (availability: string) {
            if (availability === cast.ReceiverAvailability.AVAILABLE) {
                if (receiver) {
                    cast._requestSession(receiver, resolve, reject);
                } else {
                    cast.requestSession(resolve, reject);
                }
            }
        }

        const sessionRequest = new cast.SessionRequest(
                cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);

        const apiConfig = new cast.ApiConfig(
                sessionRequest
              , null               // sessionListener
              , receiverListener); // receiverListener

        cast.initialize(apiConfig);
    });
}

function loadMediaUrl (
        mediaUrl: string
      , receiver: Receiver): Promise<cast.Session> {

    return new Promise(async (resolve, reject) => {

        const isLocalMedia = mediaUrl.startsWith("file://");
        const isLocalMediaEnabled = await options.get("localMediaEnabled");

        if (isLocalMedia && !isLocalMediaEnabled) {
            console.error("fx_cast (Debug): Local media casting not enabled");
            return;
        }


        const mediaUrlObject = new URL(mediaUrl);
        const mediaInfo = new cast.media.MediaInfo(mediaUrlObject.href, null);

        mediaInfo.metadata = new cast.media.GenericMediaMetadata();
        mediaInfo.metadata.metadataType = cast.media.MetadataType.GENERIC;
        mediaInfo.metadata.title = mediaUrlObject.pathname;


        const mediaSession = await getMediaSession(receiver);

        const loadRequest = new cast.media.LoadRequest(mediaInfo);
        loadRequest.autoplay = false;

        mediaSession.loadMedia(loadRequest
              , null                  // successCallback
              , () => { reject(); }); // errorCallback
    });
}


export default {
    getMediaSession
  , loadMediaUrl
};

