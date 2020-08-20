"use strict";

import child_process from "child_process";
import fs from "fs";
import http from "http";
import path from "path";
import stream from "stream";

import mime from "mime-types";

import { Message, Messages } from "./types";
import { sendMessage } from "./nativeMessaging";


/**
 * Reads a SubRip file and outputs text content as WebVTT.
 */
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


export let mediaServer: http.Server;

export async function handleMessage (message: Message) {
    switch (message.subject) {
        case "bridge:/mediaServer/start": {
            const { filePath, port } = message.data;

            close();

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
                    sendMessage({
                        subject: "mediaCast:/mediaServer/error"
                    });

                    break;
                }
            } catch (err) {
                console.error("Error: Failed to find media path.");
                sendMessage({
                    subject:  "mediaCast:/mediaServer/error"
                });

                break;
            }

            const contentType = mime.lookup(filePath);
            if (!contentType) {
                sendMessage({
                    subject: "mediaCast:/mediaServer/error"
                });

                break;
            }

            /**
             * Find any SubRip files within the same directory and
             * convert to WebVTT source.
             */
            const subtitles = new Map<string, string>();
            try {
                const dirEntries = await fs.promises.readdir(
                        fileDir, { withFileTypes: true });

                for (const dirEntry of dirEntries) {
                    if (dirEntry.isFile()
                     && mime.lookup(dirEntry.name) === "application/x-subrip") {

                        subtitles.set(dirEntry.name, await convertSrtToVtt(
                                path.join(fileDir, dirEntry.name)));
                    }
                }
            } catch (err) {}

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

            mediaServer.on("listening", () => sendMessage({
                subject: "mediaCast:/mediaServer/started"
              , data: {
                    mediaPath: fileName
                  , subtitlePaths: Array.from(subtitles.keys())
                }
            }));

            mediaServer.on("close", () => sendMessage({
                subject: "mediaCast:/mediaServer/stopped"
            }));
            mediaServer.on("error", () => sendMessage({
                subject: "mediaCast:/mediaServer/error"
            }));

            mediaServer.listen(port);

            break;
        }

        case "bridge:/mediaServer/stop": {
            close();
            break;
        }
    }
}

export function close () {
    if (mediaServer && mediaServer.listening) {
        mediaServer.close();
    }
}
