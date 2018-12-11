"use strict";

import { Transform } from "stream";


/**
 * Takes a handler function that implements the transform
 * and calls the transform callback.
 */
const response = (handler) => new Transform({
    readableObjectMode: true
  , writableObjectMode: true

  , transform (chunk, encoding, callback) {

        Promise.resolve(handler(chunk, callback))
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
const decode = new Transform({
    readableObjectMode: true

  , transform (chunk, encoding, callback) {
        // Setup persistent data
        if (!this.hasOwnProperty("buf")
                && !this.hasOwnProperty("message_length")) {

            this.buf = Buffer.alloc(0);
            this.message_length = null;
        }

        // Append next chunk to buffer
        this.buf = Buffer.concat([ this.buf, chunk ]);

        while (true) {
            if (this.message_length === null) {
                if (this.buf.length >= 4) {

                    // Read message length
                    this.message_length = this.buf.readUInt32LE(0);

                    // Offset buffer
                    this.buf = this.buf.slice(4);

                    continue;
                }
            } else {
                if (this.buf.length >= this.message_length) {
                    const message = JSON.parse(this.buf.slice(
                            0, this.message_length));

                    this.push(message);

                    // Cleanup persistent data
                    this.buf = this.buf.slice(this.message_length);
                    this.message_length = null;

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
const encode = new Transform({
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


export {
    response
  , decode
  , encode
};
