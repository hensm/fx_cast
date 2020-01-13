import dnssd from "dnssd";

import child_process from "child_process";
import events from "events";
import fs from "fs";
import http from "http";
import mime from "mime-types";
import path from "path";

import Media from "./Media";
import Session from "./Session";
import StatusListener from "./StatusListener";

import { DecodeTransform
       , EncodeTransform } from "../transforms";

import { ReceiverStatus } from "./castTypes";

import { Message } from "./types";

import { __applicationName
       , __applicationVersion } from "../../package.json";


// Increase listener limit
events.EventEmitter.defaultMaxListeners = 50;


const decodeTransform = new DecodeTransform();
const encodeTransform = new EncodeTransform();

// stdin -> stdout
process.stdin.pipe(decodeTransform);
decodeTransform.on("data", handleMessage);
encodeTransform.pipe(process.stdout);

decodeTransform.on("error", err => {
    console.error("Failed to decode message", err);
});

/**
 * Encode and send a message to the extension. If message is
 * a string, send that as the message subject, else send a
 * passed message object.
 */
function sendMessage (message: string | object) {
    try {
        if (typeof message === "string") {
            encodeTransform.write({
                subject: message
            });
        } else {
            encodeTransform.write(message);
        }
    } catch (err) {
        console.error("Failed to encode message", err);
    }
}


interface InitializeOptions {
    shouldWatchStatus?: boolean;
}


let receiverSelectorApp: child_process.ChildProcess;
let receiverSelectorAppClosed = true;

// Local media server
let mediaServer: http.Server;

let browser: dnssd.Browser;


// Existing counterpart Media/Session objects
const existingSessions: Map<string, Session> = new Map();
const existingMedia: Map<string, Media> = new Map();


process.on("SIGTERM", () => {
    if (mediaServer && mediaServer.listening) {
        mediaServer.close();
    }

    if (receiverSelectorApp && !receiverSelectorAppClosed) {
        receiverSelectorApp.kill();
    }

    browser.stop();
});


/**
 * Handle incoming messages from the extension and forward
 * them to the appropriate handlers.
 *
 * Initializes the counterpart objects and is responsible
 * for managing existing ones.
 */
async function handleMessage (message: Message) {
    if (message.subject.startsWith("bridge:/media/")) {
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

    if (message.subject.startsWith("bridge:/session/")) {
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

    if (message.subject.startsWith("bridge:/receiverSelector/")) {
        handleReceiverSelectorMessage(message);
    }

    if (message.subject.startsWith("bridge:/mediaServer/")) {
        handleMediaServerMessage(message);
    }

    switch (message.subject) {
        case "bridge:/getInfo": {
            encodeTransform.write(__applicationVersion);
            break;
        }

        case "bridge:/initialize": {
            const options: InitializeOptions = message.data;
            initialize(options);

            break;
        }
    }
}

function handleReceiverSelectorMessage (message: Message) {
    switch (message.subject) {
        case "bridge:/receiverSelector/open": {
            const receiverSelectorData = message.data;

            if (process.platform !== "darwin") {
                console.error("Invalid platform for native selector.");
                process.exit(1);
            }

            if (!receiverSelectorData) {
                console.error("Missing native selector data.");
                process.exit(1);
            } else {
                try {
                    JSON.parse(receiverSelectorData);
                } catch (err) {
                    console.error("Invalid native selector data.");
                }
            }

            // Kill existing process if it exists
            if (receiverSelectorApp && !receiverSelectorAppClosed) {
                receiverSelectorApp.kill();
            }

            const receiverSelectorPath = path.join(process.cwd()
                  , "fx_cast_selector.app/Contents/MacOS/fx_cast_selector");

            receiverSelectorApp = child_process.spawn(
                    receiverSelectorPath
                  , [ receiverSelectorData ]);

            receiverSelectorAppClosed = false;

            receiverSelectorApp.stdout!.setEncoding("utf8");
            receiverSelectorApp.stdout!.on("data", data => {
                sendMessage({
                    subject: "main:/receiverSelector/selected"
                  , data: JSON.parse(data)
                });
            });

            receiverSelectorApp.on("error", err => {
                sendMessage({
                    subject: "main:/receiverSelector/error"
                  , data: err.message
                });
            });

            receiverSelectorApp.on("close", () => {
                if (!receiverSelectorAppClosed) {
                    receiverSelectorAppClosed = true;

                    sendMessage({
                        subject: "main:/receiverSelector/close"
                    });
                }
            });

            break;
        }

        case "bridge:/receiverSelector/close": {
            receiverSelectorApp.kill();
            receiverSelectorAppClosed = true;

            break;
        }
    }
}

function handleMediaServerMessage (message: Message) {
    switch (message.subject) {
        case "bridge:/mediaServer/start": {
            const { filePath, port }
                : { filePath: string, port: number } = message.data;

            const contentType = mime.lookup(filePath);

            if (!contentType) {
                sendMessage("mediaCast:/mediaServer/error");
                break;
            }

            if (mediaServer && mediaServer.listening) {
                mediaServer.close();
            }

            mediaServer = http.createServer((req, res) => {
                const { size: fileSize } = fs.statSync(filePath);
                const { range } = req.headers;

                // Partial content HTTP 206
                if (range) {
                    const bounds = range.substring(6).split("-");
                    const start = parseInt(bounds[0]);
                    const end = bounds[1] ? parseInt(bounds[1]) : fileSize - 1;

                    res.writeHead(206, {
                        "Accept-Ranges": "bytes"
                      , "Content-Range": `bytes ${start}-${end}/${fileSize}`
                      , "Content-Length": (end - start) + 1
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

            mediaServer.on("listening", () => {
                sendMessage("mediaCast:/mediaServer/started");
            });
            mediaServer.on("close", () => {
                sendMessage("mediaCast:/mediaServer/stopped");
            });
            mediaServer.on("error", () => {
                sendMessage("mediaCast:/mediaServer/error");
            });

            mediaServer.listen(port);

            break;
        }

        case "bridge:/mediaServer/stop": {
            if (mediaServer && mediaServer.listening) {
                mediaServer.close();
            }

            break;
        }
    }
}


function initialize (options: InitializeOptions) {
    browser = new dnssd.Browser(dnssd.tcp("googlecast"));
    browser.on("error", err => {
        console.error("Discovery failed", err);
    });

    if (options.shouldWatchStatus) {
        browser.on("serviceUp", onStatusBrowserServiceUp);
        browser.on("serviceDown", onStatusBrowserServiceDown);
    }

    browser.on("serviceUp", onBrowserServiceUp);
    browser.on("servicedown", onBrowserServiceDown);
    browser.start();


    function onBrowserServiceUp (service: dnssd.Service) {
        sendMessage({
            subject: "shim:/serviceUp"
          , data: {
                host: service.addresses[0]
              , port: service.port
              , id: service.txt.id
              , friendlyName: service.txt.fn
            }
        });
    }

    function onBrowserServiceDown (service: dnssd.Service) {
        sendMessage({
            subject: "shim:/serviceDown"
          , data: {
                id: service.txt.id
            }
        });
    }


    // Receiver status listeners for status mode
    const statusListeners = new Map<string, StatusListener>();

    function onStatusBrowserServiceUp (service: dnssd.Service) {
        const { id } = service.txt;

        const listener = new StatusListener(
                service.addresses[0]
              , service.port);

        listener.on("receiverStatus", (status: ReceiverStatus) => {
            const receiverStatusMessage: any = {
                subject: "receiverStatus"
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

    function onStatusBrowserServiceDown (service: dnssd.Service) {
        const { id } = service.txt;

        if (statusListeners.has(id)) {
            statusListeners.get(id)!.deregister();
            statusListeners.delete(id);
        }
    }
}
