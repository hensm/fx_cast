"use strict";

import { spawn } from "child_process";
import { Readable } from "stream";

import path from "path";
import WebSocket from "ws";

import { DecodeTransform
       , EncodeTransform } from "../transforms";


const wss = new WebSocket.Server({ port: 9999 });

wss.on("connection", socket => {

    /**
     * Daemon and bridge are the same binary, so spawn a new
     * version of self in bridge mode.
     */
    const bridge = spawn(process.execPath);

    // Stream for incoming WebSocket messages
    const messageStream = new Readable({
        objectMode: true
    });

    // tslint:disable-next-line:no-empty
    messageStream._read = () => {};

    /**
     * Incoming JSON messages from the extension over the
     * WebSocket connection are parsed and re-encoded to be sent
     * to bridge stdin.
     */
    socket.on("message", (message: string) => {
        messageStream.push(JSON.parse(message));
    });

    messageStream
        .pipe(new EncodeTransform())
        .pipe(bridge.stdin);

    /**
     * Incoming messages from the bridge are decoded and
     * stringified and sent to the extension over the WebSocket
     * connection.
     */
    bridge.stdout
        .pipe(new DecodeTransform())
        .on("data", data => {
            socket.send(JSON.stringify(data));
        });

    // Handle termination
    socket.on("close", () => bridge.kill());
    bridge.on("exit", () => socket.close());
});
