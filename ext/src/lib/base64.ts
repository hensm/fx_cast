"use strict";

export function encode (array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
}

export function decode (encodedString: string): Uint8Array {
    return new Uint8Array(
            atob(encodedString)
                .split("")
                .map(c => c.charCodeAt(0)));
}
