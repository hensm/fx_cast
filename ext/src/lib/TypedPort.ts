"use strict";

const portMap = new WeakMap<TypedPort<any>, browser.runtime.Port>();

/**
 * Allows typed access to a runtime.Port object.
 */
export class TypedPort<T> {
    public name: string;
    public error?: { message: string };
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
    };

    public onMessage = {
        addListener: (cb: (message: T) => void) => {
            portMap.get(this)?.onMessage.addListener(cb as any);
        }
      , removeListener: (cb: (message: T) => void) => {
            portMap.get(this)?.onMessage.removeListener(cb as any);
        }
      , hasListener: (cb: (message: T) => void) => {
            return portMap.get(this)?.onMessage.hasListener(cb as any) ?? false;
        }
    };

    public postMessage (message: T) {
        portMap.get(this)?.postMessage(message as any);
    }
}
