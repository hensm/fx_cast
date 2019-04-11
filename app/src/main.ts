import dnssd from "dnssd";

import events from "events";
import fs from "fs";
import http from "http";
import mime from "mime-types";
import path from "path";

import Media from "./Media";
import Session from "./Session";
import StatusListener from "./StatusListener";
import * as transforms from "./transforms";

import { Message } from "./types";

import { __applicationName
       , __applicationVersion } from "../package.json";


// Increase listener limit
events.EventEmitter.defaultMaxListeners = 50;


const browser = new dnssd.Browser(dnssd.tcp("googlecast"));

// Local media server
let httpServer: http.Server;

process.on("SIGTERM", () => {
    if (httpServer) {
        httpServer.close();
    }
});

// stdin -> stdout
process.stdin
    .pipe(transforms.decode)
    .pipe(transforms.response(handleMessage))
    .pipe(transforms.encode)
    .pipe(process.stdout);

/**
 * Encode and send a message to the extension.
 */
function sendMessage (message: object) {
    try {
        transforms.encode.write(message);
    } catch (err) {
        console.error("Failed to encode message");
    }
}


interface InitializeOptions {
    shouldWatchStatus?: boolean;
}

// Existing counterpart Media/Session objects
const existingSessions: Map<string, Session> = new Map();
const existingMedia: Map<string, Media> = new Map();

/**
 * Handle incoming messages from the extension and forward
 * them to the appropriate handlers.
 *
 * Initializes the counterpart objects and is responsible
 * for managing existing ones.
 */
async function handleMessage (message: Message) {
    if (message.subject.startsWith("bridge:/media/")) {
        if (existingMedia.has(message._id)) {
            // Forward message to instance message handler
            existingMedia.get(message._id).messageHandler(message);
        } else {
            if (message.subject.endsWith("/initialize")) {
                // Get Session object media belongs to
                const parentSession = existingSessions.get(
                        message.data._internalSessionId);

                // Create Media
                existingMedia.set(message._id, new Media(
                        message.data.sessionId
                      , message.data.mediaSessionId
                      , message._id
                      , parentSession
                      , sendMessage));
            }
        }

        return;
    }

    if (message.subject.startsWith("bridge:/session/")) {
        if (existingSessions.has(message._id)) {
            // Forward message to instance message handler
            existingSessions.get(message._id).messageHandler(message);
        } else {
            if (message.subject.endsWith("/initialize")) {
                // Create Session
                existingSessions.set(message._id, new Session(
                        message.data.address
                      , message.data.port
                      , message.data.appId
                      , message.data.sessionId
                      , message._id
                      , sendMessage));
            }
        }

        return;
    }

    switch (message.subject) {
        case "bridge:/getInfo": {
            const extensionVersion = message.data;
            return __applicationVersion;
        }

        case "bridge:/initialize": {
            const options: InitializeOptions = message.data;
            initialize(options);

            break;
        }


        case "bridge:/startHttpServer": {
            const { filePath, port } = message.data;

            httpServer = http.createServer((req, res) => {
                const { size: fileSize } = fs.statSync(filePath);
                const { range } = req.headers;

                const contentType = mime.lookup(filePath) || "video/mp4";

                // Partial content HTTP 206
                if (range) {
                    const bounds = range.substring(6).split("-");

                    const start = parseInt(bounds[0]);
                    const end = bounds[1]
                        ? parseInt(bounds[1])
                        : fileSize - 1;

                    const chunkSize = (end - start) + 1;

                    res.writeHead(206, {
                        "Accept-Ranges": "bytes"
                      , "Content-Range": `bytes ${start}-${end}/${fileSize}`
                      , "Content-Length": chunkSize
                      , "Content-Type": contentType
                    });

                    fs.createReadStream(filePath, { start, end }).pipe(res);

                } else {
                    res.writeHead(200, {
                        "Content-Length": fileSize
                      , "Content-Type": contentType
                    });

                    fs.createReadStream(filePath).pipe(res);
                }
            });

            httpServer.listen(port, () => {
                sendMessage({
                    subject: "mediaCast:/httpServerStarted"
                });
            });

            break;
        }

        case "bridge:/stopHttpServer": {
            if (httpServer) {
                httpServer.close();
            }
            break;
        }
    }
}

function initialize (options: InitializeOptions) {
    const statusListeners = new Map<string, StatusListener>();

    browser.on("serviceUp", (service: dnssd.Service) => {
        const address = service.addresses[0];
        const port = service.port;
        const id = service.txt.id;

        if (options.shouldWatchStatus) {
            const listener = new StatusListener(address, port);

            listener.on("statusUpdate", (status: any) => {
                sendMessage({
                    subject: "main:/receiverStatusUpdate"
                  , data: { id, status }
                });
            });

            statusListeners.set(id, listener);
        }

        transforms.encode.write({
            subject: "shim:/serviceUp"
          , data: {
                address, port, id
              , friendlyName: service.txt.fn
              , currentApp: service.txt.rs
            }
        });
    });

    browser.on("serviceDown", (service: dnssd.Service) => {
        const id = service.txt.id;

        if (options.shouldWatchStatus && statusListeners.has(id)) {
            statusListeners.get(id).deregister();
        }

        transforms.encode.write({
            subject: "shim:/serviceDown"
          , data: { id }
        });
    });

    browser.start();
}
