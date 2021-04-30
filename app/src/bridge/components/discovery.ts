"use strict";

import { EventEmitter } from "events";

import { Channel, Client } from "castv2";

import mdns from "mdns";

import { sendMessage } from "../lib/nativeMessaging";

import { ReceiverStatus } from "./chromecast/types";
import { NS_CONNECTION
       , NS_HEARTBEAT
       , NS_RECEIVER } from "./chromecast/Session";


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
            : mdns.rst.getaddrinfo({ families: [ 4 ]})
      , mdns.rst.makeAddressesUnique()
    ]
});

function onBrowserServiceUp(service: mdns.Service) {
    // Ignore without txt record / name
    if (!service.txtRecord || !service.name) {
        return;
    }

    const txtRecord = service.txtRecord as CastTxtRecord;
    sendMessage({
        subject: "main:receiverDeviceUp"
      , data: {
            receiverDevice: {
                host: service.addresses[0]
              , port: service.port
              , id: service.name
              , friendlyName: txtRecord.fn
            }
        }
    });
}

function onBrowserServiceDown(service: mdns.Service) {
    // Ignore without name
    if (!service.name) {
        return;
    }

    const txtRecord = service.txtRecord as CastTxtRecord;
    sendMessage({
        subject: "main:receiverDeviceDown"
      , data: { receiverDeviceId: service.name }
    });
}

browser.on("serviceUp", onBrowserServiceUp);
browser.on("serviceDown", onBrowserServiceDown);


interface InitializeOptions {
    shouldWatchStatus?: boolean;
}

export function startDiscovery(options: InitializeOptions) {
    if (options.shouldWatchStatus) {
        browser.on("serviceUp", onStatusBrowserServiceUp);
        browser.on("serviceDown", onStatusBrowserServiceDown);
    }

    browser.start();

    // Receiver status listeners for status mode
    const statusListeners = new Map<string, StatusListener>();

    function onStatusBrowserServiceUp(service: mdns.Service) {
        if (!service.name) {
            return;
        }

        const listener = new StatusListener(
                service.addresses[0], service.port);

        listener.on("receiverStatus", (status: ReceiverStatus) => {
            if (!service.name) {
                return;
            }

            sendMessage({
                subject: "main:receiverDeviceUpdated"
              , data: {
                    receiverDeviceId: service.name
                  , status
                }
            });
        });

        statusListeners.set(service.name, listener);
    }

    function onStatusBrowserServiceDown(service: mdns.Service) {
        if (!service.name) {
            return;
        }

        const listener = statusListeners.get(service.name);
        listener?.deregister();
    }
}

export function stopDiscovery() {
    browser.stop();
}


/**
 * Creates a connection to a receiver device and forwards
 * RECEIVER_STATUS updates to the extension.
 */
 export default class StatusListener extends EventEmitter {
    private client: Client;
    private clientReceiver?: Channel;
    private clientHeartbeatIntervalId?: NodeJS.Timeout;

    constructor(host: string, port: number) {
        super();

        this.client = new Client();
        this.client.connect({ host, port }, this.onConnect.bind(this));

        this.client.on("close", () => {
            clearInterval(this.clientHeartbeatIntervalId!);
        });

        this.client.on("error", () => {
            clearInterval(this.clientHeartbeatIntervalId!);
        });
    }

    /**
     * Closes status listener connection.
     */
    public deregister(): void {
        if (this.clientReceiver) {
            this.clientReceiver.send({ type: "CLOSE" });
        }

        this.client.close();
    }


    private onConnect(): void {
        const sourceId = "sender-0";
        const destinationId = "receiver-0";

        const clientConnection = this.client.createChannel(
                sourceId, destinationId, NS_CONNECTION, "JSON");
        const clientHeartbeat = this.client.createChannel(
                sourceId, destinationId, NS_HEARTBEAT, "JSON");
        const clientReceiver = this.client.createChannel(
                sourceId, destinationId, NS_RECEIVER, "JSON");

        clientReceiver.on("message", data => {
            switch (data.type) {
                case "CLOSE": {
                    this.client.close();
                    break;
                }

                case "RECEIVER_STATUS": {
                    this.emit("receiverStatus", data.status);
                    break;
                }
                case "MEDIA_STATUS": {
                    this.emit("mediaStatus", data.status);
                    break;
                }
            }
        });

        clientConnection.send({ type: "CONNECT" });
        clientHeartbeat.send({ type: "PING" });
        clientReceiver.send({ type: "GET_STATUS", requestId: 1 });

        this.clientReceiver = clientReceiver;

        this.clientHeartbeatIntervalId = setInterval(() => {
            clientHeartbeat.send({ type: "PING" });
        }, 5000);
    }
}
