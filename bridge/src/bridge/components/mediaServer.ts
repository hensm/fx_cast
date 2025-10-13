import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import stream from "stream";

import mime from "mime-types";

import type { Messenger } from "../messaging";
import { convertSrtToVtt } from "../lib/subtitles";

export let mediaServer: http.Server | undefined;

export async function startMediaServer(
    messaging: Messenger,
    filePath: string,
    port: number
) {
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
            messaging.sendMessage({
                subject: "mediaCast:mediaServerError",
                data: "Media path is not a file."
            });

            return;
        }
    } catch (err) {
        messaging.sendMessage({
            subject: "mediaCast:mediaServerError",
            data: "Failed to find media path."
        });

        return;
    }

    const contentType = mime.lookup(filePath);
    if (!contentType) {
        messaging.sendMessage({
            subject: "mediaCast:mediaServerError",
            data: "Failed to find media type."
        });

        return;
    }

    /**
     * Find any SubRip files within the same directory and
     * convert to WebVTT source.
     */
    const subtitles = new Map<string, string>();
    try {
        const dirEntries = await fs.promises.readdir(fileDir, {
            withFileTypes: true
        });

        for (const dirEntry of dirEntries) {
            if (
                dirEntry.isFile() &&
                mime.lookup(dirEntry.name) === "application/x-subrip"
            ) {
                subtitles.set(
                    dirEntry.name,
                    await convertSrtToVtt(path.join(fileDir, dirEntry.name))
                );
            }
        }
    } catch (err) {
        console.error(`Error: Failed to find/convert subtitles (${filePath}).`);
    }

    mediaServer = http.createServer(async (req, res) => {
        if (!req.url) {
            return;
        }

        let decodedUrl = decodeURIComponent(req.url);
        // Drop leading slash
        if (decodedUrl.startsWith("/")) {
            decodedUrl = decodedUrl.slice(1);
        }

        switch (decodedUrl) {
            case fileName: {
                const { range } = req.headers;

                // Partial content HTTP 206
                if (range) {
                    const bounds = range.substring(6).split("-");
                    const start = parseInt(bounds[0]);
                    const end = bounds[1] ? parseInt(bounds[1]) : fileSize - 1;

                    res.writeHead(206, {
                        "Accept-Ranges": "bytes",
                        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                        "Content-Length": end - start + 1,
                        "Content-Type": contentType
                    });

                    fs.createReadStream(filePath, { start, end }).pipe(res);
                } else {
                    res.writeHead(200, {
                        "Content-Length": fileSize,
                        "Content-Type": contentType
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

    mediaServer.on("close", () => {
        messaging.sendMessage({
            subject: "mediaCast:mediaServerStopped"
        });
    });
    mediaServer.on("error", err => {
        messaging.sendMessage({
            subject: "mediaCast:mediaServerError",
            data: err.message
        });
    });

    mediaServer.listen(port, () => {
        const localAddresses: string[] = [];
        for (const iface of Object.values(os.networkInterfaces())) {
            const matchingIface = iface?.find(
                details => details.family === "IPv4" && !details.internal
            );
            if (matchingIface) {
                localAddresses.push(matchingIface.address);
            }
        }

        if (!localAddresses.length) {
            messaging.sendMessage({
                subject: "mediaCast:mediaServerError",
                data: "Failed to get local address."
            });
            stopMediaServer();
            return;
        }

        messaging.sendMessage({
            subject: "mediaCast:mediaServerStarted",
            data: {
                mediaPath: fileName,
                subtitlePaths: Array.from(subtitles.keys()),
                localAddress: localAddresses[0]
            }
        });
    });
}

export function stopMediaServer() {
    return new Promise<void>((resolve, reject) => {
        if (!mediaServer?.listening) {
            resolve();
            return;
        }

        mediaServer.close(err => {
            if (err) {
                reject();
            } else {
                resolve();
            }
        });

        mediaServer = undefined;
    });
}
