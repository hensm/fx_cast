/// <reference types="node" />

declare module "fast-srp-hap" {
    import Buffer from "buffer";

    interface Param {
        N_length_bits: number;
        N: any;
        g: any;
        hash: string;
    }

    export const params: { [key: number]: Param };

    type GenKeyCallback = (err: string, buf: Buffer) => void;

    export function genKey(bytes: number, callback: GenKeyCallback): void;

    export function computeVerifier(
        params: object,
        salt: Buffer,
        I: Buffer,
        P: Buffer
    ): Buffer;

    export class Client {
        constructor(
            params: object,
            salt_buf: Buffer,
            identity_buf: Buffer,
            password_buf: Buffer,
            secret1_buf: Buffer
        );

        computeA(): Buffer;
        setB(B_buf: Buffer): void;
        computeM1(): Buffer;
        checkM2(serverM2_buf: Buffer): void;
        computeK(): Buffer;
    }

    export class Server {
        constructor(params: object, verifier_buf: Buffer, secret2_buf: Buffer);

        computeB(): Buffer;
        setA(A_buf: Buffer): void;
        checkM1(clientM1_buf: Buffer): Buffer;
        computeK(): Buffer;
    }
}
