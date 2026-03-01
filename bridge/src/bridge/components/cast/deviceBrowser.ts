import { EventEmitter } from "events";
import { DnsSdBrowser } from "../../../dns_sd";
import type { ReceiverDevice } from "../../messagingTypes";

/**
 * Chromecast TXT record fields.
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

export default class CastDeviceBrowser extends EventEmitter<{
    deviceUp: [device: ReceiverDevice];
    deviceDown: [deviceId: string];
}> {
    browser = new DnsSdBrowser("_googlecast._tcp");

    constructor() {
        super();
        /**
         * When a service is found, gather device info from service object and
         * TXT record, then send a `main:deviceUp` message.
         */
        this.browser.on("serviceUp", service => {
            // Filter invalid results
            if (!service.txtRecord || !service.name) return;

            const address = service.address4 ?? service.address6;
            if (!address) return;

            const record = service.txtRecord as unknown as CastRecord;
            const device: ReceiverDevice = {
                id: record.id,
                friendlyName: record.fn,
                modelName: record.md,
                capabilities: parseInt(record.ca),
                host: address,
                port: service.port
            };

            this.emit("deviceUp", device);
        });

        /**
         * When a service is lost, send a `main:deviceDown` message with the
         * service name as the `deviceId`.
         */
        this.browser.on("serviceDown", name => {
            // Filter invalid results
            if (!name) return;

            this.emit("deviceDown", name);
        });
    }

    start() {
        this.browser.start();
    }
    stop() {
        this.browser.stop();
    }
}
