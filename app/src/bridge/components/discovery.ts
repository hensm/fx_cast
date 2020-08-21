"use strict";

import mdns from "mdns";

import StatusListener from "./chromecast/StatusListener";
import { ReceiverStatus } from "../types";
import { sendMessage } from "../lib/messaging";


const browser = mdns.createBrowser(mdns.tcp("googlecast"), {
    resolverSequence: [
        mdns.rst.DNSServiceResolve()
      , "DNSServiceGetAddrInfo" in mdns.dns_sd
            ? mdns.rst.DNSServiceGetAddrInfo()
              // Some issues on Linux with IPv6, so restrict to IPv4
            : mdns.rst.getaddrinfo({ families: [ 4 ] })
      , mdns.rst.makeAddressesUnique()
    ]
});

function onBrowserServiceUp (service: mdns.Service) {
    sendMessage({
        subject: "main:/serviceUp"
      , data: {
            host: service.addresses[0]
          , port: service.port
          , id: service.txtRecord.id
          , friendlyName: service.txtRecord.fn
        }
    });
}

function onBrowserServiceDown (service: mdns.Service) {
    sendMessage({
        subject: "main:/serviceDown"
      , data: {
            id: service.txtRecord.id
        }
    });
}

browser.on("serviceUp", onBrowserServiceUp);
browser.on("servicedown", onBrowserServiceDown);


interface InitializeOptions {
    shouldWatchStatus?: boolean;
}

export function startDiscovery (options: InitializeOptions) {
    if (options.shouldWatchStatus) {
        browser.on("serviceUp", onStatusBrowserServiceUp);
        browser.on("serviceDown", onStatusBrowserServiceDown);
    }

    browser.start();

    // Receiver status listeners for status mode
    const statusListeners = new Map<string, StatusListener>();

    function onStatusBrowserServiceUp (service: mdns.Service) {
        const { id } = service.txtRecord;

        const listener = new StatusListener(
                service.addresses[0]
              , service.port);

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

    function onStatusBrowserServiceDown (service: mdns.Service) {
        const { id } = service.txtRecord;

        if (statusListeners.has(id)) {
            statusListeners.get(id)!.deregister();
            statusListeners.delete(id);
        }
    }
}

export function stopDiscovery () {
    browser.stop();
}
