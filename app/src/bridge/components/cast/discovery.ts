import mdns from "mdns";

import type { ReceiverDevice } from "../../messagingTypes";

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

interface DiscoveryOptions {
    onDeviceFound(device: ReceiverDevice): void;
    onDeviceDown(deviceId: string): void;
}

export default class Discovery {
    browser = mdns.createBrowser(mdns.tcp("googlecast"), {
        resolverSequence: [
            mdns.rst.DNSServiceResolve(),
            "DNSServiceGetAddrInfo" in mdns.dns_sd
                ? mdns.rst.DNSServiceGetAddrInfo()
                : // Some issues on Linux with IPv6, so restrict to IPv4
                  mdns.rst.getaddrinfo({ families: [4] }),
            mdns.rst.makeAddressesUnique()
        ]
    });

    constructor(opts: DiscoveryOptions) {
        /**
         * When a service is found, gather device info from service
         * object and TXT record, then send a `main:deviceUp` message.
         */
        this.browser.on("serviceUp", service => {
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

            opts.onDeviceFound(device);
        });

        /**
         * When a service is lost, send a `main:deviceDown` message with
         * the service name as the `deviceId`.
         */
        this.browser.on("serviceDown", service => {
            // Filter invalid results
            if (!service.name) return;

            opts.onDeviceDown(service.name);
        });
    }

    start() {
        this.browser.start();
    }
    stop() {
        this.browser.stop();
    }
}
