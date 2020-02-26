"use strict";

import { spawn } from "child_process";
import { Readable } from "stream";

import minimist from "minimist";
import WebSocket from "ws";

import { DecodeTransform
       , EncodeTransform } from "../transforms";


const argv = minimist(process.argv.slice(2), {
    string: [ "port" ]
  , default: {
        port: "9556"
    }
});

const port = parseInt(argv.port);
if (!port || port < 1025 || port > 65535) {
    console.error("Invalid port specified!");
    process.exit(1);
}

const wss = new WebSocket.Server({ port });

wss.on("connection", socket => {
    // Stream for incoming WebSocket messages
    const messageStream = new Readable({ objectMode: true });
    messageStream._read = () => {};

    socket.on("message", (message: string) => {
        messageStream.push(JSON.parse(message));
    });


    /**
     * Daemon and bridge are the same binary, so spawn a new
     * version of self in bridge mode.
     */
    const bridge = spawn(process.execPath, [ process.argv[1] ]);

    // socket -> bridge.stdin
    messageStream
        .pipe(new EncodeTransform())
        .pipe(bridge.stdin);

    // bridge.stdout -> socket
    bridge.stdout
        .pipe(new DecodeTransform())
        .on("data", data => {
            // Socket can be CLOSING here
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(data));
            }
        });

    // Handle termination
    socket.on("close", () => bridge.kill());
    bridge.on("exit", () => socket.close());
});
