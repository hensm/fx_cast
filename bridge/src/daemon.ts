import http from "http";
import https from "https";
import { ChildProcess, spawn } from "child_process";
import { Readable, Writable } from "stream";
import * as bridge from "./bridge";

import chalk from "chalk";
import WebSocket from "ws";

import { DecodeTransform, EncodeTransform } from "./transforms.js";
import { WebsocketMessenger } from "./bridge/messaging";

// Ensure child processes are killed on exit
process.on("SIGTERM", async () => {
    process.exit(1);
});

export interface DaemonOpts {
    host: string;
    port: number;
    password?: string;
    secure?: boolean;
    key?: Buffer;
    cert?: Buffer;
}

export function init(opts: DaemonOpts) {
    const server = !opts.secure
        ? http.createServer()
        : https.createServer({
              key: opts.key,
              cert: opts.cert
          });

    const wss = new WebSocket.Server({ noServer: true });

    wss.on("connection", socket => {
        bridge.run(new WebsocketMessenger(socket));
    });

    /**
     * Authenticates requests by checking password URL param against
     * server password specified in launch options.
     */
    function authenticate(req: http.IncomingMessage) {
        if (!opts.password) return true;

        const password = new URL(
            req.url!,
            `http://${req.headers.host}`
        ).searchParams.get("password");

        return password === opts.password;
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

    if (
        opts.host !== "localhost" &&
        opts.host !== "127.0.0.1" &&
        !opts.secure
    ) {
        process.stdout.write(
            chalk.red(
                "WARNING: A non-local host is set, but secure connections are not enabled!\n"
            )
        );
    }

    process.stdout.write(
        `Starting WebSocket server at ${opts.secure ? "wss" : "ws"}://${
            opts.host.includes(":") ? `[${opts.host}]` : opts.host
        }:${opts.port}... `
    );
    server.listen({ port: opts.port, host: opts.host }, () => {
        process.stdout.write("Done!\n");
    });

    server.on("error", err => {
        console.error("Failed!");
        console.error(err.message);
    });
}
