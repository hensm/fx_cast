"use strict";

import crypto from "crypto";
import nacl from "tweetnacl";

/**
 * Client ID and keypair. Existing ID and secret key can be
 * passed as constructor parameters, otherwise new
 * credentials are generated.
 */
export default class AirPlayAuthCredentials {
    public clientId: string;
    public clientSk: Uint8Array;
    public clientPk: Uint8Array;

    constructor (
            clientId?: string
          , clientSk?: Uint8Array
          , clientPk?: Uint8Array) {

        if (clientId && clientSk && clientPk) {
            this.clientId = clientId;
            this.clientSk = clientSk;
            this.clientPk = clientPk;
        } else {
            const keyPair = nacl.sign.keyPair();

            // Random 16-len string
            this.clientId = crypto.randomBytes(8).toString("hex");
            this.clientSk = keyPair.secretKey.slice(0, 32);
            this.clientPk = keyPair.publicKey;
        }
    }
}
