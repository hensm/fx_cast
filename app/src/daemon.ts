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
            try {
                messageStream.push(JSON.parse(message));
            } catch (err) {
                // Catch parse errors and close socket
                socket.close();
            }
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
        /**
         * Only accept authenticated WebSocket requests from extension
         * origins.
         */
        if (
            req.headers.origin?.startsWith("moz-extension://") &&
            authenticate(req)
        ) {
            wss.handleUpgrade(req, socket, head, ws => {
                wss.emit("connection", ws, req);
            });

            return;
        }

        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
    });

    /**
     * Browser WebSocket API does not allow access to connection errors,
     * so provide an endpoint for feedback on invalid authentication.
     */
    server.on("request", (req, res) => {
        /**
         * Requests from extensions have their origin header stripped,
         * so block all requests with origin headers.
         */
        if ("origin" in req.headers) {
            req.destroy();
            return;
        }

        res.writeHead(authenticate(req) ? 200 : 401);
        res.end();
    });

    server.listen(port);
}
