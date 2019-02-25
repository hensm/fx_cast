"use strict";

import { Transform } from "stream";
import { Message } from "./types";


interface ResponseHandlerFunction {
    (message: Message): Promise<any>
}

/**
 * Takes a handler function that implements the transform
 * and calls the transform callback.
 */
export const response = (handler: ResponseHandlerFunction) => new Transform({
    readableObjectMode: true
  , writableObjectMode: true

  , transform (chunk: Message, encoding, callback) {
        Promise.resolve(handler(chunk))
            .then(response => {
                if (response) {
                    callback(null, response);
                } else {
                    callback(null);
                }
            });
    }
});


/**
 * Takes input, decodes the message string, parses as JSON
 * and outputs the parsed result.
 */
export const decode = new Transform({
    readableObjectMode: true

  , transform (chunk, encoding, callback) {
        const self = this as any;

        // Setup persistent data
        if (!this.hasOwnProperty("_buf")
         && !this.hasOwnProperty("_messageLength")) {

            self._buf = Buffer.alloc(0);
            self._messageLength = null;
        }

        // Append next chunk to buffer
        self._buf = Buffer.concat([ self._buf, chunk ]);

        while (true) {
            if (self._messageLength === null) {
                if (self._buf.length >= 4) {

                    // Read message length
                    self._messageLength = self._buf.readUInt32LE(0);

                    // Offset buffer
                    self._buf = self._buf.slice(4);

                    continue;
                }
            } else {
                if (self._buf.length >= self._messageLength) {
                    const message = JSON.parse(self._buf.slice(
                            0, self._messageLength));

                    this.push(message);

                    // Cleanup persistent data
                    self._buf = self._buf.slice(self._messageLength);
                    self._messageLength = null;

                    // Parse next message
                    continue;
                }
            }

            // No complete messages left
            callback();
            break;
        }
    }
});


/**
 * Takes input, encodes the message length and content and
 * outputs the encoded result.
 */
export const encode = new Transform({
    writableObjectMode: true

  , transform (chunk, encoding, callback) {
        const message_length = Buffer.alloc(4);
        const message = Buffer.from(JSON.stringify(chunk));

        // Write message length
        message_length.writeUInt32LE(message.length, 0);

        // Output joined message length and content
        callback(null, Buffer.concat([message_length, message]));
    }
});
