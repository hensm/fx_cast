"use strict";

export interface TypedEvents {
    [key: string]: any;
}

export class TypedEventTarget<T extends TypedEvents> extends EventTarget {
    public addEventListener<K extends keyof T> (
            type: K, listener: (ev: CustomEvent<T[K]>) => void): void {
        super.addEventListener(type as string, listener);
    }

    public removeEventListener<K extends keyof T> (
            type: K, listener: (ev: CustomEvent<T[K]>) => void): void {
        super.removeEventListener(type as string, listener);
    }

    public dispatchEvent<K extends keyof T> (ev: CustomEvent<T[K]>): boolean {
        return super.dispatchEvent(ev);
    }
}
