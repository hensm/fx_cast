"use strict";

import Session from "./Session";
import Media from "./Media";


// Existing counterpart Media/Session objects
const existingSessions: Map<string, Session> = new Map();
const existingMedia: Map<string, Media> = new Map();

export function handleSessionMessage (message: any) {
    if (!message._id) {
        console.error("Session message missing _id");
        return;
    }

    const sessionId = message._id;

    if (existingSessions.has(sessionId)) {
        // Forward message to instance message handler
        existingSessions.get(sessionId)?.messageHandler(message);
    } else {
        if (message.subject === "bridge:/session/initialize") {
            existingSessions.set(sessionId, new Session(
                    message.data.address
                  , message.data.port
                  , message.data.appId
                  , message.data.sessionId
                  , sessionId));
        }
    }
}

export function handleMediaMessage (message: any) {
    if (!message._id) {
        console.error("Media message missing _id");
        return;
    }

    const mediaId = message._id;

    if (existingMedia.has(mediaId)) {
        // Forward message to instance message handler
        existingMedia.get(mediaId)!.messageHandler(message);
    } else {
        if (message.subject === "bridge:/media/initialize") {
            // Get Session object media belongs to
            const parentSession = existingSessions.get(
                    message.data._internalSessionId);

            if (parentSession) {
                // Create Media
                existingMedia.set(mediaId, new Media(
                        mediaId
                      , parentSession));
            }
        }
    }
}
