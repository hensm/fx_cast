"use strict";

/**
 * Provides a typed interface to runtime.Port objects.
 */
export interface TypedPort<T>
    extends Omit<
        browser.runtime.Port,
        "onDisconnect" | "onMessage" | "postMessage"
    > {
    onDisconnect: {
        addListener(cb: (port: TypedPort<T>) => void): void | Promise<void>;
        removeListener(cb: (port: TypedPort<T>) => void): void | Promise<void>;
        hasListener(cb: (port: TypedPort<T>) => void): boolean;
        hasListeners(): boolean;
    };
    onMessage: {
        addListener(cb: (message: T) => void): void | Promise<void>;
        removeListener(cb: (message: T) => void): void | Promise<void>;
        hasListener(cb: (message: T) => void): boolean;
        hasListeners(): boolean;
    };
    postMessage(message: T): void;
}
