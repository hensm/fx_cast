import { EventEmitter } from "events";

const native = require("bindings")("dns_sd");

export interface Service {
    /** Service instance name */
    name: string;
    /** Resolved hostname */
    host: string;
    /** Service port */
    port: number;
    /** Resolved IPv4 address */
    address4?: string;
    /** Resolved IPv6 address */
    address6?: string;
    /** DNS TXT record key-value pairs */
    txtRecord: Record<string, string>;
}

interface NativeDnsSdBrowser {
    start(): void;
    stop(): void;
}
const NativeDnsSdBrowser = native.DnsSdBrowser as {
    new (
        serviceType: string,
        callback: (eventType: string, data: Service | string) => void
    ): NativeDnsSdBrowser;
};

export interface DnsSdBrowserEvents {
    serviceUp: [service: Service];
    serviceDown: [name: string];
}

export class DnsSdBrowser extends EventEmitter<DnsSdBrowserEvents> {
    private nativeBrowser: NativeDnsSdBrowser | null = null;

    constructor(private serviceType: string) {
        super();
    }

    public start(): void {
        if (!this.nativeBrowser) {
            this.nativeBrowser = new NativeDnsSdBrowser(
                this.serviceType,
                (eventType, data) => {
                    switch (eventType) {
                        case "serviceUp":
                            this.emit("serviceUp", data as Service);
                            break;
                        case "serviceDown":
                            this.emit("serviceDown", data as string);
                            break;
                    }
                }
            );
            this.nativeBrowser.start();
        }
    }

    public stop(): void {
        if (this.nativeBrowser) {
            this.nativeBrowser.stop();
            this.nativeBrowser = null;
        }
    }
}
