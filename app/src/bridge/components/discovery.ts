"use strict";

import { MDNSServiceDiscovery } from "tinkerhub-mdns";

import StatusListener from "./chromecast/StatusListener";
import { ReceiverStatus } from "../types";
import { sendMessage } from "../lib/messaging";


let browser : MDNSServiceDiscovery | null = null;

function onBrowserServiceUp (service: any) {
    sendMessage({
        subject: "main:/serviceUp"
      , data: {
            host: service.addresses[0].host
          , port: service.addresses[0].port
          , id: service.id
          , friendlyName: new TextDecoder().decode(
              service.binaryData.filter(
                  (arr: Array<number>) =>
                      arr[0]==0x66 && arr[1]==0x6e)[0].slice(3)
            )
        }
    });
}

function onBrowserServiceDown (service: any) {
    sendMessage({
        subject: "main:/serviceDown"
      , data: {
            id: service.id
        }
    });
}

function onBrowserServiceUpdate (service: any) {
    onBrowserServiceDown(service);
    onBrowserServiceUp(service);
}

function startBrowser () {
    if (browser) {
        browser.destroy();
    }
    browser = new MDNSServiceDiscovery({ type: 'googlecast' });

    browser.onAvailable(onBrowserServiceUp);
    browser.onUnavailable(onBrowserServiceDown);
    browser.onUpdate(onBrowserServiceUpdate);
}

interface InitializeOptions {
    shouldWatchStatus?: boolean;
}

export function startDiscovery (options: InitializeOptions) {
    startBrowser();

    if (browser && options.shouldWatchStatus) {
        browser.onAvailable(onStatusBrowserServiceUp);
        browser.onUnavailable(onStatusBrowserServiceDown);
        browser.onUpdate(onStatusBrowserServiceUpdate);
    }

    // Receiver status listeners for status mode
    const statusListeners = new Map<string, StatusListener>();

    function onStatusBrowserServiceUp (service: any) {
        const id = service.id;

        const listener = new StatusListener(
                service.addresses[0].host
              , service.addresses[0].port);

        listener.on("receiverStatus", (status: ReceiverStatus) => {
            const receiverStatusMessage: any = {
                subject: "main:/receiverStatus"
              , data: {
                    id
                  , status: {
                        volume: {
                            level: status.volume.level
                          , muted: status.volume.muted
                        }
                    }
                }
            };

            if (status.applications && status.applications.length) {
                const application = status.applications[0];

                receiverStatusMessage.data.status.application = {
                    appId: application.appId
                  , displayName: application.displayName
                  , isIdleScreen: application.isIdleScreen
                  , statusText: application.statusText
                };
            }

            sendMessage(receiverStatusMessage);
        });

        statusListeners.set(id, listener);
    }

    function onStatusBrowserServiceDown (service: any) {
        const id = service.id;

        if (statusListeners.has(id)) {
            statusListeners.get(id)!.deregister();
            statusListeners.delete(id);
        }
    }

    function onStatusBrowserServiceUpdate (service: any) {
        onStatusBrowserServiceDown(service);
        onStatusBrowserServiceUp(service);
    }
}

export function stopDiscovery () {
    if (browser) {
        browser.destroy();
        browser = null;
    }
}
