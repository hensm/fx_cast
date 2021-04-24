"use strict";

import { TypedPort } from "./TypedPort";


interface RuntimeConnectInfo {
    name: string;
}
interface TabConnectInfo {
    name: string;
    frameId: number;
}

export default class Messenger<T> {
    connect (connectInfo: RuntimeConnectInfo) {
        return browser.runtime.connect(connectInfo) as
                unknown as TypedPort<T>;
    }

    connectTab (tabId: number, connectInfo: TabConnectInfo) {
        return browser.tabs.connect(tabId, connectInfo) as
                unknown as TypedPort<T>;
    }

    onConnect = {
        addListener (cb: (port: TypedPort<T>) => void) {
            browser.runtime.onConnect.addListener(cb as any);
        }
      , removeListener (cb: (port: TypedPort<T>) => void) {
            browser.runtime.onConnect.removeListener(cb as any);
        }
      , hasListener (cb: (port: TypedPort<T>) => void) {
            return browser.runtime.onConnect.hasListener(cb as any);
        }
    }
};
