import mdns from "mdns";

import child_process from "child_process";
import events from "events";
import fs from "fs";
import http from "http";
import mime from "mime-types";
import path from "path";
import stream from "stream";

import Media from "./Media";
import Session from "./Session";
import StatusListener from "./StatusListener";

import { DecodeTransform
       , EncodeTransform } from "../transforms";

import { ReceiverStatus } from "./castTypes";
import { Message, Receiver } from "./types";

import { __applicationName
       , __applicationVersion } from "../../package.json";

import { Channel, Client } from "castv2";
import { NS_CONNECTION
       , NS_HEARTBEAT
       , NS_RECEIVER } from "./Session";


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

let browser: mdns.Browser;


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

    if (browser) {
        browser.stop();
    }
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

        case "bridge:/stopReceiverApp": {
            const receiver: Receiver = message.data.receiver;
            const client = new Client();

            client.connect({ host: receiver.host, port: receiver.port }, () => {
                const sourceId = "sender-0";
                const destinationId = "receiver-0";

                const clientConnection = client.createChannel(
                        sourceId, destinationId, NS_CONNECTION, "JSON");
                const clientReceiver = client.createChannel(
                        sourceId, destinationId, NS_RECEIVER, "JSON");

                clientConnection.send({ type: "CONNECT" });
                clientReceiver.send({ type: "STOP", requestId: 1 });
            });

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
                const parsedData = JSON.parse(data);

                sendMessage({
                    subject: !parsedData.mediaType
                        ? "main:/receiverSelector/stop"
                        : "main:/receiverSelector/selected"
                  , data: parsedData
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

async function handleMediaServerMessage (message: Message) {
    async function convertSrtToVtt (srtFilePath: string) {
        const fileStream = fs.createReadStream(
                srtFilePath, { encoding: "utf-8" });

        let fileContents = "";
        for await (let chunk of fileStream) {
            // Omit BOM if present
            if (!fileContents && chunk[0] === "\uFEFF") {
                chunk = chunk.slice(1);
            }

            // Normalize line endings
            fileContents += chunk.replace(/$\r\n/gm, "\n");
        }


        let vttText = "WEBVTT\n";

        /**
         * Matches a caption group within an SubRip file. Match groups
         * are the index (followed by a new line), the time range
         * (followed by a new line), then any text content until a blank
         * line.
         */
        const REGEX_CAPTION = /(?:(\d+)\n(\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}))\n((?:.+)\n?)*/g;

        /**
         * WebVTT is very similar to SubRip, the main differences being
         * the "WEBVTT" specifier and optional metadata at the head of
         * the file, the optional caption indicies and the timecode
         * millisecond separator.
         */
        for (const groups of fileContents.matchAll(REGEX_CAPTION)) {
            const captionSource = groups[0];
            const captionIndex = groups[1];
            const captionTime = groups[2];
            const captionText = groups[3];

            vttText += `\n${captionIndex}\n`;
            vttText += `${captionTime.replace(/,/g, ".")}\n`;

            if (captionText) {
                vttText += `${captionText}`;
            }
        }

        return vttText;
    }

    switch (message.subject) {
        case "bridge:/mediaServer/start": {
            const { filePath, port }
                : { filePath: string, port: number } = message.data;

            if (mediaServer && mediaServer.listening) {
                mediaServer.close();
            }


            let fileDir: string;
            let fileName: string;
            let fileSize: number;

            try {
                const stat = await fs.promises.lstat(filePath);

                if (stat.isFile()) {
                    fileDir = path.dirname(filePath);
                    fileName = path.basename(filePath);
                    fileSize = stat.size;
                } else {
                    console.error("Error: Media path is not a file.");
                    sendMessage("mediaCast:/mediaServer/error");
                    break;
                }
            } catch (err) {
                console.error("Error: Failed to find media path.");
                sendMessage("mediaCast:/mediaServer/error");
                break;
            }

            const contentType = mime.lookup(filePath);
            if (!contentType) {
                sendMessage("mediaCast:/mediaServer/error");
                break;
            }


            // file name -> file contents
            const subtitles = new Map<string, string>();

            try {
                const dirEntries = await fs.promises.readdir(
                        fileDir, { withFileTypes: true });

                /**
                 * Find any SubRip files within the same directory and
                 * convert to WebVTT source.
                 */
                for (const dirEntry of dirEntries) {
                    if (dirEntry.isFile()
                     && mime.lookup(dirEntry.name) === "application/x-subrip") {

                        subtitles.set(dirEntry.name, await convertSrtToVtt(
                                path.join(fileDir, dirEntry.name)));
                    }
                }
            } catch (err) {
                // Subtitles optional
            }


            mediaServer = http.createServer(async (req, res) => {
                if (!req.url) {
                    return;
                }

                // Drop leading slash
                if (req.url.startsWith("/")) {
                    req.url = req.url.slice(1);
                }

                switch (req.url) {
                    case fileName: {
                        const { range } = req.headers;

                        // Partial content HTTP 206
                        if (range) {
                            const bounds = range.substring(6).split("-");
                            const start = parseInt(bounds[0]);
                            const end = bounds[1]
                                ? parseInt(bounds[1]) : fileSize - 1;

                            res.writeHead(206, {
                                "Accept-Ranges": "bytes"
                              , "Content-Range": `bytes ${start}-${end}/${fileSize}`
                              , "Content-Length": (end - start) + 1
                              , "Content-Type": contentType
                            });

                            fs.createReadStream(
                                    filePath, { start, end }).pipe(res);
                        } else {
                            res.writeHead(200, {
                                "Content-Length": fileSize
                              , "Content-Type": contentType
                            });

                            fs.createReadStream(filePath).pipe(res);
                        }
                        break;
                    }

                    default: {
                        if (subtitles.has(req.url)) {
                            const vttSource = subtitles.get(req.url)!;
                            const vttStream = stream.Readable.from(vttSource);

                            res.setHeader("Access-Control-Allow-Origin", "*");

                            vttStream.pipe(res);
                        }

                        break;
                    }
                }
            });

            mediaServer.on("listening", () => {
                sendMessage({
                    subject: "mediaCast:/mediaServer/started"
                  , data: {
                        mediaPath: fileName
                      , subtitlePaths: Array.from(subtitles.keys())
                    }
                });
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
    browser = mdns.createBrowser(mdns.tcp("googlecast"), {
        resolverSequence: [
            mdns.rst.DNSServiceResolve()
          , "DNSServiceGetAddrInfo" in mdns.dns_sd
                ? mdns.rst.DNSServiceGetAddrInfo()
                  // Some issues on Linux with IPv6, so restrict to IPv4
                : mdns.rst.getaddrinfo({ families: [ 4 ] })
          , mdns.rst.makeAddressesUnique()
        ]
    });

    browser.on("error", (err: any) => {
        console.error("Discovery failed", err);
    });

    if (options.shouldWatchStatus) {
        browser.on("serviceUp", onStatusBrowserServiceUp);
        browser.on("serviceDown", onStatusBrowserServiceDown);
    }

    browser.on("serviceUp", onBrowserServiceUp);
    browser.on("servicedown", onBrowserServiceDown);
    browser.start();


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
