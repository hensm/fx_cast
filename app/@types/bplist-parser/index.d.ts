/// <reference types="node" />

declare module "bplist-parser" {
    import Buffer from "buffer";

    export var maxObjectSize: number;
    export var maxObjectCount: number;

    export class UID {
        constructor (id: number);
        UID: number;
    }

    type ParseFileCallback = (
            err: string
          , result?: Buffer) => void;

    export function parseFile (
            fileNameOrBuffer: Buffer | string
          , callback: ParseFileCallback): void;

    export function parseBuffer (buffer: Buffer): any;
}
