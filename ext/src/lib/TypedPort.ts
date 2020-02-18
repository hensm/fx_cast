"use strict";

const portMap = new WeakMap<any, browser.runtime.Port>();

/**
 * Allows typed access to a runtime.Port object.
 */
export class TypedPort<T extends any[]> {
    public name: string;
    public error: { message: string };
    public sender?: browser.runtime.MessageSender;

    constructor (port: browser.runtime.Port) {
        portMap.set(this, port);
        this.name = port.name;

        // @ts-ignore
        this.error = null;
    }

    public disconnect () {
        portMap.get(this)?.disconnect();
    }

    public onDisconnect = {
        addListener: (cb: (port: TypedPort<T>) => void) => {
            portMap.get(this)?.onDisconnect.addListener(cb as any);
        }
      , removeListener: (cb: (port: TypedPort<T>) => void) => {
            portMap.get(this)?.onDisconnect.addListener(cb as any);
        }
      , hasListener: (cb: (port: TypedPort<T>) => void) => {
            return portMap.get(this)?.onDisconnect.hasListener(cb as any)
                    ?? false;
        }
      , hasListeners: () => {
            return portMap.get(this)?.onMessage.hasListeners() ?? false;
        }
    };

    public onMessage = {
        addListener: (cb: (message: T[number]) => void) => {
            portMap.get(this)?.onMessage.addListener(cb);
        }
      , removeListener: (cb: (message: T[number]) => void) => {
            portMap.get(this)?.onMessage.removeListener(cb);
        }
      , hasListener: (cb: (message: T[number]) => void) => {
            return portMap.get(this)?.onMessage.hasListener(cb as any) ?? false;
        }
      , hasListeners: () => {
          return portMap.get(this)?.onMessage.hasListeners() ?? false;
        }
    };

    public postMessage (message: T[number]) {
        portMap.get(this)?.postMessage(message);
    }
}
