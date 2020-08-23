"use strict";

import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import stream from "stream";

import mime from "mime-types";

import { sendMessage } from "../lib/messaging";
import { convertSrtToVtt } from "../lib/subtitles";


export let mediaServer: http.Server | undefined;

export async function startMediaServer (filePath: string, port: number) {
    if (mediaServer?.listening) {
        await stopMediaServer();
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
            sendMessage({
                subject: "mediaCast:/mediaServer/error"
            });

            return;
        }
    } catch (err) {
        console.error("Error: Failed to find media path.");
        sendMessage({
            subject:  "mediaCast:/mediaServer/error"
        });

        return;
    }

    const contentType = mime.lookup(filePath);
    if (!contentType) {
        console.error("Error: Failed to find media type.");
        sendMessage({
            subject: "mediaCast:/mediaServer/error"
        });

        return;
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

    mediaServer.on("listening", () => {
        let localAddress = "";
        const ifaces = Object.values(os.networkInterfaces());
        for (const iface of ifaces) {
            const matchingIface = iface?.find(
                    details => details.family === "IPv4" && !details.internal);
            if (matchingIface) {
                localAddress = matchingIface.address;
            }
        }

        if (!localAddress) {
            console.error("Failed to get local address.");
            sendMessage({
                subject: "mediaCast:/mediaServer/error"
            });
            stopMediaServer();
            return;
        }

        sendMessage({
            subject: "mediaCast:/mediaServer/started"
          , data: {
                mediaPath: fileName
              , subtitlePaths: Array.from(subtitles.keys())
              , localAddress
            }
        });
    });

    mediaServer.on("close", () => sendMessage({
        subject: "mediaCast:/mediaServer/stopped"
    }));
    mediaServer.on("error", () => sendMessage({
        subject: "mediaCast:/mediaServer/error"
    }));

    mediaServer.listen(port);
}

export function stopMediaServer () {
    if (mediaServer?.listening) {
        mediaServer.close();
        mediaServer = undefined;
    }
}
