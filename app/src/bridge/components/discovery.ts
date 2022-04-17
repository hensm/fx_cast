"use strict";

import mdns from "mdns";

import Remote from "./cast/remote";
import { ReceiverDevice } from "../types";
import { sendMessage } from "../lib/nativeMessaging";

/**
 * Chromecast TXT record
 */
interface CastRecord {
    // Device ID
    id: string;
    // Model name (e.g. Chromecast, Google Nest Mini, etc...)
    md: string;
    // Friendly name (user-visible)
    fn: string;
    // Capabilities
    ca: string;
    // Version (?)
    ve: string;
    // Icon path (?)
    ic: string;

    cd: string;
    rm: string;
    st: string;
    bs: string;
    nf: string;
    rs: string;
}

const browser = mdns.createBrowser(mdns.tcp("googlecast"), {
    resolverSequence: [
        mdns.rst.DNSServiceResolve(),
        "DNSServiceGetAddrInfo" in mdns.dns_sd
            ? mdns.rst.DNSServiceGetAddrInfo()
            : // Some issues on Linux with IPv6, so restrict to IPv4
              mdns.rst.getaddrinfo({ families: [4] }),
        mdns.rst.makeAddressesUnique()
    ]
});

interface InitializeOptions {
    shouldWatchStatus?: boolean;
}

let shouldWatchStatus: boolean;
export function startDiscovery(options: InitializeOptions) {
    shouldWatchStatus = options.shouldWatchStatus ?? false;

    browser.start();
}

export function stopDiscovery() {
    browser.stop();
}

/**
 * Map of device IDs to remote instances.
 */
const remotes = new Map<string, Remote>();

/**
 * When a service is found, gather device info from service object and
 * TXT record, then send a `main:receiverDeviceUp` message.
 */
browser.on("serviceUp", service => {
    // Filter invalid results
    if (!service.txtRecord || !service.name) return;

    const record = service.txtRecord as CastRecord;
    const device: ReceiverDevice = {
        id: record.id,
        friendlyName: record.fn,
        modelName: record.md,
        capabilities: parseInt(record.ca),
        host: service.addresses[0],
        port: service.port
    };

    sendMessage({
        subject: "main:receiverDeviceUp",
        data: {
            deviceId: device.id,
            deviceInfo: device
        }
    });

    if (shouldWatchStatus) {
        remotes.set(
            service.name,
            new Remote(device.host, {
                // RECEIVER_STATUS
                onReceiverStatusUpdate(status) {
                    sendMessage({
                        subject: "main:receiverDeviceStatusUpdated",
                        data: { deviceId: device.id, status }
                    });
                },
                // MEDIA_STATUS
                onMediaStatusUpdate(status) {
                    if (!status) return;

                    sendMessage({
                        subject: "main:receiverDeviceMediaStatusUpdated",
                        data: { deviceId: device.id, status }
                    });
                }
            })
        );
    }
});

/**
 * When a service is lost, send a `main:receiverDeviceDown` message with
 * the service name as the `deviceId`.
 */
browser.on("serviceDown", service => {
    // Filter invalid results
    if (!service.name) return;

    sendMessage({
        subject: "main:receiverDeviceDown",
        data: { deviceId: service.name }
    });

    if (shouldWatchStatus) {
        remotes.get(service.name)?.disconnect();
    }
});
