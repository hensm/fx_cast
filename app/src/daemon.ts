"use strict";

import http, { IncomingMessage } from "http";
import WebSocket from "ws";

import { spawn } from "child_process";
import { Readable } from "stream";

import { DecodeTransform, EncodeTransform } from "./transforms";

export function init(port: number, serverPassword?: string) {
    const server = http.createServer();
    const wss = new WebSocket.Server({ noServer: true });

    process.stdout.write("Starting WebSocket server... ");

    server.on("listening", () => {
        process.stdout.write("Done!\n");
    });
    wss.on("error", err => {
        console.error("Failed!");
        console.error(err.message);
    });

    wss.on("connection", socket => {
        // Stream for incoming WebSocket messages
        const messageStream = new Readable({ objectMode: true });
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        messageStream._read = () => {};

        socket.on("message", (message: string) => {
            messageStream.push(JSON.parse(message));
        });

        /**
         * Daemon and bridge are the same binary, so spawn a new
         * version of self in bridge mode.
         */
        const bridge = spawn(process.execPath, [process.argv[1]]);

        // socket -> bridge.stdin
        messageStream.pipe(new EncodeTransform()).pipe(bridge.stdin);

        // bridge.stdout -> socket
        bridge.stdout.pipe(new DecodeTransform()).on("data", data => {
            if (socket.readyState !== WebSocket.OPEN) {
                return;
            }

            socket.send(JSON.stringify(data));
        });

        // Handle termination
        socket.on("close", () => bridge.kill());
        bridge.on("exit", () => socket.close());
    });

    /**
     * Authenticates requests by checking password URL param against
     * server password specified in launch options.
     */
    function authenticate(req: IncomingMessage) {
        if (!serverPassword) return true;

        const password = new URL(
            req.url!,
            `http://${req.headers.host}`
        ).searchParams.get("password");

        return password === serverPassword;
    }

    server.on("upgrade", (req, socket, head) => {
        if (
            // Only accept WebSocket requests from extension origins
            !req.headers.origin?.startsWith("moz-extension://") ||
            !authenticate(req)
        ) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, ws => {
            wss.emit("connection", ws, req);
        });
    });

    /**
     * JS WebSocket API does not allow access to connection errors, so
     * provide an endpoint for feedback on invalid authentication.
     */
    server.on("request", (req, res) => {
        if (!authenticate(req)) {
            res.writeHead(401);
            res.end();

            return;
        }

        res.writeHead(200);
        res.end();
    });

    server.listen(port);
}
