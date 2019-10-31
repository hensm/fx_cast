/**
 * AirPlay device auth implementation.
 *
 * References:
 *  - https://htmlpreview.github.io/?https://github.com/philippe44/RAOP-Player/blob/master/doc/auth_protocol.html
 *  - https://github.com/funtax/AirPlayAuth
 *  - https://github.com/ldiqual/chrome-airplay
 *  - https://github.com/postlund/pyatv/blob/master/docs/airplay.rst
 */

"use strict";

import { Buffer } from "buffer";
import crypto from "crypto";

import bplistCreate from "bplist-creator";
import bplistParse from "bplist-parser";
import srp6a from "fast-srp-hap";

import AirPlayAuthCredentials from "./AirPlayAuthCredentials";


const AIRPLAY_PORT = 7000;
const MIMETYPE_BPLIST = "application/x-apple-binary-plist";


export default class AirPlayAuth {
    private address: string;
    private credentials: AirPlayAuthCredentials;
    private baseUrl: URL;

    constructor (address: string, credentials: AirPlayAuthCredentials) {
        this.address = address;
        this.credentials = credentials;

        this.baseUrl = new URL(`http://${this.address}:${AIRPLAY_PORT}`);
    }

    /**
     * Begins pairing process.
     */
    public async beginPairing (): Promise<any> {
        return this.sendPostRequest("/pair-pin-start");
    }

    /**
     * Pairs client with receiver. Must be called after
     * beginPairing(). Coordinates the three pairing stages and
     * manages request responses.
     */
    public async finishPairing (pin: string): Promise<void> {
        // Stage 1 response
        const { pk: serverPk
              , salt: serverSalt } = await this.pairSetupPin1();

        // SRP params must 2048-bit SHA1
        const srpParams = srp6a.params[2048];
        srpParams.hash = "sha1";

        const { clientId, clientSk } = this.credentials;

        // Create SRP client
        const srpClient = new srp6a.Client(
                srpParams                           // Params
              , serverSalt                          // Receiver salt
              , Buffer.from(clientId)               // Username
              , Buffer.from(pin)                    // Password (receiver pin)
              , Buffer.from(Array.from(clientSk))); // Client secret key

        // Add receiver's public key
        srpClient.setB(serverPk);

        // Stage 2 response
        await this.pairSetupPin2(
                srpClient.computeA()    // SRP public key
              , srpClient.computeM1()); // SRP proof

        // Stage 3 response
        await this.pairSetupPin3(srpClient.computeK());
    }

    /**
     * Pairing Stage 1
     * ---------------
     * Triggering the receiver passcode display and receiving
     * its public key / salt.
     */
    private async pairSetupPin1 (): Promise<any> {
        const [ response ] = await this.sendPostRequestBplist(
                "/pair-setup-pin"
              , {
                    method: "pin"
                  , user: this.credentials.clientId
                });

        return response;
    }

    /**
     * Pairing Stage 2
     * ---------------
     * Generating SRP public key and proof with the client/server
     * public keys, sending them to the receiver and receiving its
     * proof.
     */
    private async pairSetupPin2 (
            pk: Buffer
          , proof: Buffer)
            : Promise<any> {

        const [ response ] = await this.sendPostRequestBplist(
                "/pair-setup-pin"
              , { pk, proof });

        return response;
    }

    /**
     * Pairing Stage 3
     * ---------------
     * AES encoding the client public key with the SRP shared
     * secret hash and sending it to the receiver. Receiver then
     * responds confirming the pairing is complete.
     */
    private async pairSetupPin3 (
            sharedSecretHash: crypto.BinaryLike): Promise<any> {

        // Create AES key
        const aesKey = crypto.createHash("sha512")
            .update("Pair-Setup-AES-Key")
            .update(sharedSecretHash)
            .digest()
            .slice(0, 16);

        // Create AES IV
        const aesIv = crypto.createHash("sha512")
            .update("Pair-Setup-AES-IV")
            .update(sharedSecretHash)
            .digest()
            .slice(0, 16);

        aesIv[15]++;


        const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, aesIv);

        // Encode client public key
        const epk = cipher.update(this.credentials.clientPk);
        cipher.final();
        const authTag = cipher.getAuthTag();

        const [ response ] = await this.sendPostRequestBplist(
                "/pair-setup-pin"
              , { epk, authTag });

        return response;
    }


    /**
     * Sends a POST request to receiver and returns the
     * response.
     */
    private async sendPostRequest (
            path: string
          , contentType?: string
          , data?: Buffer | string)
            : Promise<any> {

        // Create URL from base receiver URL and path
        const requestUrl = new URL(path, this.baseUrl);
        const requestHeaders = new Headers({
            "User-Agent": "AirPlay/320.20"
        });

        // Append Content-Type header if request has body
        if (data && contentType) {
            requestHeaders.append("Content-Type", contentType);
        }

        const response = await fetch(requestUrl.href, {
            method: "POST"
          , headers: requestHeaders
          , body: data
        });

        if (!response.ok) {
            throw new Error(`AirPlay request error: ${response.status}`);
        }

        return await response.arrayBuffer();
    }

    /**
     * Encodes binary plist data, sends a POST request to
     * receiver, then decodes and returns the response.
     */
    private async sendPostRequestBplist (
            path: string
          , data?: object)
            : Promise<any> {

        // Convert data to compatible type
        const requestBody = data
            ? bplistCreate(data)
            : undefined;

        const response = await this.sendPostRequest(
                path, MIMETYPE_BPLIST, requestBody);

        // Convert response data to Buffer for bplist-parser
        return bplistParse.parseBuffer(Buffer.from(response));
    }
}
