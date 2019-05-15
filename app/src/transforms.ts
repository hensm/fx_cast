"use strict";

import { Transform } from "stream";
import { Message } from "./bridge/types";


type ResponseHandlerFunction = (message: Message) => Promise<any>;

/**
 * Takes a handler function that implements the transform
 * and calls the transform callback.
 */
export class ResponseTransform extends Transform {
    constructor (private _handler: ResponseHandlerFunction) {
        super({
            readableObjectMode: true
          , writableObjectMode: true
        });
    }

    public _transform (
            chunk: Message
          , encoding: string
            // tslint:disable-next-line:ban-types
          , callback: Function) {

        Promise.resolve(this._handler(chunk))
            .then(res => {
                if (res) {
                    callback(null, res);
                } else {
                    callback(null);
                }
            });
    }
}


/**
 * Takes input, decodes the message string, parses as JSON
 * and outputs the parsed result.
 */
export class DecodeTransform extends Transform {
    // Message data
    private _messageBuffer = Buffer.alloc(0);
    private _messageLength: number = null;

    constructor () {
        super({
            readableObjectMode: true
        });
    }

    public _transform (
            chunk: any
          , encoding: string
            // tslint:disable-next-line:ban-types
          , callback: Function) {

       // Append next chunk to buffer
       this._messageBuffer = Buffer.concat([
           this._messageBuffer
         , chunk
       ]);

       for (;;) {
           if (this._messageLength === null) {
               if (this._messageBuffer.length >= 4) {
                   // Read message length and offset buffer
                   this._messageLength = this._messageBuffer.readUInt32LE(0);
                   this._messageBuffer = this._messageBuffer.slice(4);

                   // Next message chunk
                   continue;
               }
           } else {
              if (this._messageBuffer.length >= this._messageLength) {
                   const message = JSON.parse(this._messageBuffer
                       .slice(0, this._messageLength)
                       .toString());

                   // Push message content
                   this.push(message);

                   // Offset buffer to start of next message
                   this._messageBuffer = this._messageBuffer.slice(
                           this._messageLength);
                   this._messageLength = null;

                   // Next message
                   continue;
               }
           }

           // No complete messages left
           callback();
           break;
       }
    }
 }


/**
 * Takes input, encodes the message length and content and
 * outputs the encoded result.
 */
export class EncodeTransform extends Transform {
    constructor () {
        super({
            writableObjectMode: true
        });
    }

    public _transform (
            chunk: any
          , encoding: string
            // tslint:disable-next-line:ban-types
          , callback: Function) {

        const messageLength = Buffer.alloc(4);
        const message = Buffer.from(JSON.stringify(chunk));

        // Write message length
        messageLength.writeUInt32LE(message.length, 0);

        // Output joined length and content
        callback(null, Buffer.concat([
            messageLength
          , message
        ]));
    }
 }
