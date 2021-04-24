"use strict";

import mdns from "mdns";

import StatusListener from "./chromecast/StatusListener";
import { ReceiverStatus } from "../types";
import { sendMessage } from "../lib/nativeMessaging";


interface CastTxtRecord {
    id: string; cd: string; rm: string;
    ve: string; md: string; ic: string;
    fn: string; ca: string; st: string;
    bs: string; nf: string; rs: string;
}

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
    // Ignore without txt record
    if (!service.txtRecord) {
        return;
    }

    const txtRecord = service.txtRecord as CastTxtRecord;

    sendMessage({
        subject: "main:serviceUp"
      , data: {
            host: service.addresses[0]
          , port: service.port
          , id: txtRecord.id
          , friendlyName: txtRecord.fn
        }
    });
}

function onBrowserServiceDown (_service: mdns.Service) {
    // TODO: Fix service down detection
}

browser.on("serviceUp", onBrowserServiceUp);
browser.on("serviceDown", onBrowserServiceDown);


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
        if (!service.txtRecord) {
            return;
        }

        const { id } = service.txtRecord;

        const listener = new StatusListener(
                service.addresses[0]
              , service.port);

        listener.on("receiverStatus", (status: ReceiverStatus) => {
            const receiverStatusMessage: any = {
                subject: "main:receiverStatus"
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

    function onStatusBrowserServiceDown (_service: mdns.Service) {
        // TODO: Fix service down detection
    }
}

export function stopDiscovery () {
    browser.stop();
}
