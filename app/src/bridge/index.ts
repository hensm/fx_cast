"use strict";

import mdns from "mdns";

import Session from "./Session";
import Media from "./Media";

import { decodeTransform, encodeTransform, sendMessage } from "./messaging";
import { Message } from "./types";

import { startDiscovery, stopDiscovery } from "./components/discovery";
import { startMediaServer, stopMediaServer } from "./components/mediaServer";
import { startReceiverSelector, stopReceiverSelector }
        from "./components/receiverSelector";

import { __applicationName, __applicationVersion} from "../../package.json";


process.on("SIGTERM", () => {
    stopDiscovery();
    stopMediaServer();
    stopReceiverSelector();
});


// Existing counterpart Media/Session objects
const existingSessions: Map<string, Session> = new Map();
const existingMedia: Map<string, Media> = new Map();


function handleSessionMessage (message: any) {
    if (!message._id) {
        console.error("Session message missing _id");
        return;
    }

    const sessionId = message._id;

    if (existingSessions.has(sessionId)) {
        // Forward message to instance message handler
        existingSessions.get(sessionId)!.messageHandler(message);
    } else {
        if (message.subject.endsWith("/initialize")) {
            // Create Session
            existingSessions.set(sessionId, new Session(
                    message.data.address
                  , message.data.port
                  , message.data.appId
                  , message.data.sessionId
                  , sessionId
                  , sendMessage));
        }
    }

    return;
}

function handleMediaMessage (message: any) {
    if (!message._id) {
        console.error("Media message missing _id");
        return;
    }

    const mediaId = message._id;

    if (existingMedia.has(mediaId)) {
        // Forward message to instance message handler
        existingMedia.get(mediaId)!.messageHandler(message);
    } else {
        if (message.subject.endsWith("/initialize")) {
            // Get Session object media belongs to
            const parentSession = existingSessions.get(
                    message.data._internalSessionId);

            if (parentSession) {
                // Create Media
                existingMedia.set(mediaId, new Media(
                        mediaId
                      , parentSession
                      , sendMessage));
            }
        }
    }

    return;
}


/**
 * Handle incoming messages from the extension and forward
 * them to the appropriate handlers.
 *
 * Initializes the counterpart objects and is responsible
 * for managing existing ones.
 */
decodeTransform.on("data", (message: Message) => {
    if (message.subject.startsWith("bridge:/session/")) {
        handleSessionMessage(message);
        return;
    }
    if (message.subject.startsWith("bridge:/media/")) {
        handleMediaMessage(message);
        return;
    }


    switch (message.subject) {
        case "bridge:/getInfo": {
            encodeTransform.write(__applicationVersion);
            break;
        }

        case "bridge:/initialize": {
            startDiscovery(message.data);
            break;
        }

        // Receiver selector
        case "bridge:/receiverSelector/open": {
            startReceiverSelector(message.data); break;
        }
        case "bridge:/receiverSelector/close": {
            stopReceiverSelector(); break;
        }

        // Media server
        case "bridge:/mediaServer/start": {
            startMediaServer(message.data.filePath, message.data.port);
            break;
        }
        case "bridge:/mediaServer/stop": {
            stopMediaServer();
            break;
        }
    }
});
