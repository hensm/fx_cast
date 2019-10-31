"use strict";

/* TEMPORARY */

import { TypedStorageArea } from "../../lib/typedStorage";
import { AirPlayAuthCredentials } from "../../lib/auth";


export interface Device {
    name: string;
    address: string;
    isPaired: boolean;
    credentials: AirPlayAuthCredentials;
}

interface DeviceEncoded extends Omit<Device, "credentials"> {
    credentials: {
        clientId: string;
        clientSk: number[];
        clientPk: number[];
    }
}

const storageArea = new TypedStorageArea<{
    devices: DeviceEncoded[];
}>(browser.storage.sync);


function encode (device: Device) {
    const encoded = device as unknown as DeviceEncoded;
    encoded.credentials.clientSk = Array.from(device.credentials.clientSk);
    encoded.credentials.clientPk = Array.from(device.credentials.clientPk);

    return encoded;
}

function decode (device: DeviceEncoded) {
    const decoded = device as unknown as Device;
    decoded.credentials.clientSk = new Uint8Array(device.credentials.clientSk);
    decoded.credentials.clientPk = new Uint8Array(device.credentials.clientPk);

    return decoded;
}


export async function getAll (): Promise<Device[]> {
    const { devices } = await storageArea.get("devices");

    if (!devices) {
        await browser.storage.sync.set({
            devices: []
        });

        return [];
    }

    return devices.map(decode);
}

export async function add (device: Device) {
    const devices = await getAll();

    if (devices.some(dv => dv.name === device.name)) {
        return;
    }

    await browser.storage.sync.set({
        devices: [
            ...devices.map(encode)
          , encode(device)
        ]
    });
}

export async function remove (device: Device) {
    const devices = await getAll();

    await browser.storage.sync.set({
        devices: devices
            .filter(dv => dv.name !== device.name)
            .map(encode)
    });
}

