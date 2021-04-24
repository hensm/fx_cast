"use strict";

import castv2 from "castv2";

import Session, { NS_CONNECTION, NS_RECEIVER } from "./Session";
import Media from "./Media";
import { Receiver } from "../../types";


// Existing counterpart Media/Session objects
const existingSessions: Map<string, Session> = new Map();
const existingMedia: Map<string, Media> = new Map();

export function handleSessionMessage (message: any) {
    if (!message.data._id) {
        console.error("Session message missing _id");
        return;
    }

    const sessionId = message.data._id;

    if (existingSessions.has(sessionId)) {
        // Forward message to instance message handler
        existingSessions.get(sessionId)?.messageHandler(message);
    } else {
        if (message.subject === "bridge:session/initialize") {
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
    if (!message.data._id) {
        console.error("Media message missing _id");
        return;
    }

    const mediaId = message.data._id;

    if (existingMedia.has(mediaId)) {
        // Forward message to instance message handler
        existingMedia.get(mediaId)!.messageHandler(message);
    } else {
        if (message.subject === "bridge:media/initialize") {
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

export function stopReceiverApp (host: string, port: number) {
    const client = new castv2.Client();

    client.connect({ host, port }, () => {
        const sourceId = "sender-0";
        const destinationId = "receiver-0";

        const clientConnection = client.createChannel(
                sourceId, destinationId, NS_CONNECTION, "JSON");
        const clientReceiver = client.createChannel(
                sourceId, destinationId, NS_RECEIVER, "JSON");

        clientConnection.send({ type: "CONNECT" });
        clientReceiver.send({ type: "STOP", requestId: 1 });
    });

    client.on("error", err => {
        console.error(`castv2 error (stopReceiverApp): ${err}`);
    });
}
