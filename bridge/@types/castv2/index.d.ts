/// <reference types="node" />

declare module "castv2" {
    import { EventEmitter } from "events";

    interface ClientConnectOptions {
        host: string;
        port?: number;
    }

    type CallbackFunction = () => void;

    export interface Channel extends EventEmitter {
        bus: Client;
        sourceId: string;
        destinationId: string;
        namespace: string;
        encoding: string;

        send(data: any): void;
        close(): void;
    }

    export interface DeviceAuthMessage {
        parse(data: any): any;
        serialize(data: any): any;
    }

    export class Client extends EventEmitter {
        public connect(
            options: ClientConnectOptions | string,
            callback?: CallbackFunction
        ): void;

        public close(): void;

        public send(
            sourceId: string,
            destinationId: string,
            namespace: string,
            data: Buffer | string
        ): void;

        public createChannel(
            sourceId: string,
            destinationId: string,
            namespace: string,
            encoding: string
        ): Channel;
    }

    export class Server extends EventEmitter {
        constructor(options: object);

        public listen(
            port: number,
            host: string,
            callback?: CallbackFunction
        ): void;

        public send(
            clientId: string,
            sourceId: string,
            destinationId: string,
            namespace: string,
            data: Buffer | string
        ): void;

        public close(): void;
    }
}
