"use strict";

import { DecodeTransform, EncodeTransform } from "../../transforms";
import { Message } from "../messaging";


export const decodeTransform = new DecodeTransform();
export const encodeTransform = new EncodeTransform();

process.stdin.pipe(decodeTransform);
encodeTransform.pipe(process.stdout);

export function sendMessage (message: Message) {
    encodeTransform.write(message);
}
