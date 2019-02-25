import dnssd from "dnssd";

import http from "http";
import fs from "fs";
import path from "path";
import mime from "mime-types";

import * as transforms from "./transforms";
import Media from "./Media";
import Session from "./Session";

import { Message } from "./types";

import { __applicationName
       , __applicationVersion } from "../package.json";


const browser = new dnssd.Browser(dnssd.tcp("googlecast"));

// Local media server
let httpServer: http.Server;

process.on("SIGTERM", () => {
    if (httpServer) httpServer.close();
});

// Increase listener limit
require("events").EventEmitter.defaultMaxListeners = 50;

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
    } catch (err) {}
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
                      , sendMessage));
            }
        }

        return;
    }

    switch (message.subject) {
        case "bridge:/getInfo": {
            const extensionVersion = message.data;
            return __applicationVersion;
        };

        case "bridge:/startDiscovery": {
            browser.start();
            break;
        };

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

                    fs.createReadStream(filePath).pipe(res)
                }
            });

            httpServer.listen(port, () => {
                sendMessage({
                    subject: "mediaCast:/httpServerStarted"
                });
            });

            break;
        };

        case "bridge:/stopHttpServer": {
            if (httpServer) httpServer.close();
            break;
        };
    }
}


browser.on("serviceUp", (service: dnssd.Service) => {
    transforms.encode.write({
        subject: "shim:/serviceUp"
      , data: {
            address: service.addresses[0]
          , port: service.port
          , id: service.txt.id
          , friendlyName: service.txt.fn
          , currentApp: service.txt.rs
        }
    });
});

browser.on("serviceDown", (service: dnssd.Service) => {
    transforms.encode.write({
        subject:"shim:/serviceDown"
      , data: {
            id: service.txt.id
        }
    });
});
