"use strict";

import fs from "fs";
import http from "http";
import mime from "mime-types";
import EventEmitter from "events";

import { Message
       , SendMessageCallback } from "./types";


export default class MediaServer extends EventEmitter {
    private httpServer: http.Server;

    constructor (
            private filePath: string
          , private port: number) {

        super();
        this.httpServer = http.createServer(this.requestListener.bind(this));
    }

    public start () {
        this.httpServer.listen(this.port, () => {
            this.emit("started");
        });
    }

    public stop () {
        if (this.httpServer && this.httpServer.listening) {
            this.httpServer.close(() => {
                this.emit("stopped");
            });
        }
    }


    private requestListener (
            req: http.IncomingMessage
          , res: http.ServerResponse) {

        const { size: fileSize } = fs.statSync(this.filePath);
        const { range } = req.headers;

        const contentType = mime.lookup(this.filePath) || "video/mp4";

        // Partial content HTTP 206
        if (range) {
            const bounds = range.substring(6).split("-");

            const start = parseInt(bounds[0]);
            const end = bounds[1] ? parseInt(bounds[1]) : fileSize - 1;

            const chunkSize = (end - start) + 1;

            res.writeHead(206, {
                "Accept-Ranges": "bytes"
              , "Content-Range": `bytes ${start}-${end}/${fileSize}`
              , "Content-Length": chunkSize
              , "Content-Type": contentType
            });

            fs.createReadStream(this.filePath, { start, end }).pipe(res);
        } else {
            res.writeHead(200, {
                "Content-Length": fileSize
              , "Content-Type": contentType
            });

            fs.createReadStream(this.filePath).pipe(res);
        }
    }
}
