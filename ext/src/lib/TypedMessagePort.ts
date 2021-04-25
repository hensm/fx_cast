"use strict";

export interface TypedMessagePort<T> extends MessagePort {
    postMessage(message: T, transfer: Transferable[]): void;
    postMessage(message: T, options?: PostMessageOptions): void;
}
