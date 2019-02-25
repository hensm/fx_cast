declare module "castv2" {
    import { EventEmitter } from "events";

    interface ClientConnectOptions {
        host: string
      , port?: number
    }

    interface ClientConnectCallback {
        (): void;
    }

    export interface ClientChannel extends EventEmitter {
        bus: Client;
        sourceId: string;
        destinationId: string;
        namespace: string;
        encoding: string;

        send (data: any): void;
        close (): void;
    }

    interface ServerListenCallback {
        (): void;
    }


    export class Client extends EventEmitter {
        connect (host: string, callback?: ClientConnectCallback): void;
        connect (options: ClientConnectOptions, callback: ClientConnectCallback): void;

        close (): void;

        send (sourceId: string
            , destinationId: string
            , namespace: string
            , data: Buffer | string): void;

        createChannel (sourceId: string
                     , destinationId: string
                     , namespace: string
                     , encoding: string): ClientChannel;
    }

    export class Server {
        constructor (options: object);

        listen (port: number
              , host: string
              , callback: ServerListenCallback): void;

        send (clientId: string
           , sourceId: string
           , destinationId: string
           , namespace: string
           , data: Buffer | string): void;

        close (): void;
    }
}
