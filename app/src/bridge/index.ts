"use strict";

import mdns from "mdns";

import { ReceiverStatus } from "./castTypes";
import { Message } from "./types";

import { decodeTransform
       , encodeTransform
       , sendMessage } from "./lib/nativeMessaging";

import Session from "./Session";
import Media from "./Media";
import StatusListener from "./StatusListener";

import * as receiverSelector from "./receiverSelector";
import * as mediaServer from "./mediaServer";

import { __applicationName
       , __applicationVersion} from "../../package.json";


process.on("SIGTERM", () => {
    browser.stop();
    mediaServer.close();
    receiverSelector.close();
});


const browser = mdns.createBrowser(mdns.tcp("googlecast"), {
    resolverSequence: [
        mdns.rst.DNSServiceResolve()
      , "DNSServiceGetAddrInfo" in mdns.dns_sd
            ? mdns.rst.DNSServiceGetAddrInfo()
              // Some issues on Linux with IPv6, so restrict to IPv4
            : mdns.rst.getaddrinfo({ families: [ 4 ] })
      , mdns.rst.makeAddressesUnique()
    ]
});

function onBrowserServiceUp (service: mdns.Service) {
    sendMessage({
        subject: "main:/serviceUp"
      , data: {
            host: service.addresses[0]
          , port: service.port
          , id: service.txtRecord.id
          , friendlyName: service.txtRecord.fn
        }
    });
}

function onBrowserServiceDown (service: mdns.Service) {
    sendMessage({
        subject: "main:/serviceDown"
      , data: {
            id: service.txtRecord.id
        }
    });
}

browser.on("serviceUp", onBrowserServiceUp);
browser.on("servicedown", onBrowserServiceDown);

browser.on("error", (err: any) => {
    console.error("Discovery failed", err);
});


interface InitializeOptions {
    shouldWatchStatus?: boolean;
}

function initialize (options: InitializeOptions) {
    if (options.shouldWatchStatus) {
        browser.on("serviceUp", onStatusBrowserServiceUp);
        browser.on("serviceDown", onStatusBrowserServiceDown);
    }

    browser.start();


    // Receiver status listeners for status mode
    const statusListeners = new Map<string, StatusListener>();

    function onStatusBrowserServiceUp (service: mdns.Service) {
        const { id } = service.txtRecord;

        const listener = new StatusListener(
                service.addresses[0]
              , service.port);

        listener.on("receiverStatus", (status: ReceiverStatus) => {
            const receiverStatusMessage: any = {
                subject: "main:/receiverStatus"
              , data: {
                    id
                  , status: {
                        volume: {
                            level: status.volume.level
                          , muted: status.volume.muted
                        }
                    }
                }
            };

            if (status.applications && status.applications.length) {
                const application = status.applications[0];

                receiverStatusMessage.data.status.application = {
                    appId: application.appId
                  , displayName: application.displayName
                  , isIdleScreen: application.isIdleScreen
                  , statusText: application.statusText
                };
            }

            sendMessage(receiverStatusMessage);
        });

        statusListeners.set(id, listener);
    }

    function onStatusBrowserServiceDown (service: mdns.Service) {
        const { id } = service.txtRecord;

        if (statusListeners.has(id)) {
            statusListeners.get(id)!.deregister();
            statusListeners.delete(id);
        }
    }
}


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

    if (message.subject.startsWith("bridge:/receiverSelector/")) {
        receiverSelector.handleMessage(message);
        return;
    }
    if (message.subject.startsWith("bridge:/mediaServer/")) {
        mediaServer.handleMessage(message);
        return;
    }
    

    switch (message.subject) {
        case "bridge:/getInfo": {
            encodeTransform.write(__applicationVersion);
            break;
        }

        case "bridge:/initialize": {
            initialize(message.data);
            break;
        }
    }
});
