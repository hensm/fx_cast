"use strict";

import * as cast from "../../cast";

import CastOptions from "./CastOptions";
import CastSession from "./CastSession";
import CastStateEventData from "./CastStateEventData";
import SessionStateEventData from "./SessionStateEventData";


export default class CastContext extends EventTarget {
    public endCurrentSession (stopCasting: boolean): void {
        console.info("STUB :: CastContext#endCurrentSession");
    }

    // @ts-ignore
    public getCastState (): string {
        console.info("STUB :: CastContext#getCastState");
    }

    // @ts-ignore
    public getCurrentSession (): CastSession {
        console.info("STUB :: CastContext#getCurrentSession");
    }

    // @ts-ignore
    public getSessionState (): string {
        console.info("STUB :: CastContext#getSessionState");
    }

    // @ts-ignore
    public requestSession (): Promise<string> {
        console.info("STUB :: CastContext#requestSession");
    }

    public setOptions (options: CastOptions): void {
        console.info("STUB :: CastContext#setOptions");
    }
}

export const instance = new CastContext();
