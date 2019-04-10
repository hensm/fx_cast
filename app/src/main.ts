import dnssd from "dnssd";

import events from "events";
import fs from "fs";
import http from "http";
import mime from "mime-types";
import path from "path";

import Media from "./Media";
import Session from "./Session";
import * as transforms from "./transforms";

import { Channel, Client } from "castv2";

import { Message } from "./types";

import { __applicationName
       , __applicationVersion } from "../package.json";


const NS_CONNECTION = "urn:x-cast:com.google.cast.tp.connection";
const NS_HEARTBEAT = "urn:x-cast:com.google.cast.tp.heartbeat";
const NS_RECEIVER = "urn:x-cast:com.google.cast.receiver";


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
    browser.on("serviceUp", (service: dnssd.Service) => {
        const address = service.addresses[0];
        const port = service.port;
        const id = service.txt.id;

        if (options.shouldWatchStatus) {
            registerStatusListener(address, port, id);
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

        if (options.shouldWatchStatus) {
            deregisterStatusListener(id);
        }

        transforms.encode.write({
            subject: "shim:/serviceDown"
          , data: { id }
        });
    });

    browser.start();
}


interface StatusListener {
    client: Client;
    clientReceiver: Channel;
}

// Map of client connections
const statusListeners = new Map<string, StatusListener>();

/**
 * Creates a connection to a receiver device and forwards
 * RECEIVER_STATUS updates to the extension.
 */
function registerStatusListener (
        host: string
      , port: number
      , id: string) {

    const client = new Client();

    const sourceId = "sender-0";
    const destinationId = "receiver-0";

    let heartbeatIntervalId: number;

    client.connect({ host, port }, () => {
        const clientConnection = client.createChannel(
                sourceId, destinationId, NS_CONNECTION, "JSON");
        const clientHeartbeat = client.createChannel(
                sourceId, destinationId, NS_HEARTBEAT, "JSON");
        const clientReceiver = client.createChannel(
                sourceId, destinationId, NS_RECEIVER, "JSON");


        clientReceiver.on("message", data => {
            switch (data.type) {
                case "CLOSE": {
                    client.close();
                    break;
                }

                case "RECEIVER_STATUS": {
                    // Send update message
                    transforms.encode.write({
                        subject: "main:/receiverStatusUpdate"
                      , data: {
                            id
                          , status: data.status
                        }
                    });

                    break;
                }
            }
        });

        clientConnection.send({ type: "CONNECT" });
        clientHeartbeat.send({ type: "PING" });
        clientReceiver.send({ type: "GET_STATUS", requestId: 1 });

        heartbeatIntervalId = setInterval(() => {
            clientHeartbeat.send({ type: "PING" });
        });

        statusListeners.set(id, {
            client
          , clientReceiver
        });
    });

    client.on("close", () => {
        clearInterval(heartbeatIntervalId);
    });
}

/**
 * Closes status listener connection for a given receiver
 * device.
 */
function deregisterStatusListener (id: string) {
    const { client, clientReceiver } = statusListeners.get(id);

    // Cleanup
    clientReceiver.send({ type: "CLOSE" });
    client.close();

    // Remove from map
    statusListeners.delete(id);
}
