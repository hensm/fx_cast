"use strict";

import CastOptions from "./CastOptions";
import CastSession from "./CastSession";
import CastStateEventData from "./CastStateEventData";
import SessionStateEventData from "./SessionStateEventData";


type EventHandler = (eventData:
        CastStateEventData
      | SessionStateEventData) => void;

export default class CastContext {
    public addEventListener (type: string, handler: EventHandler): void {
        console.info("STUB :: CastContext#addEventListener");
    }

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

    public removeEventListener (type: string, handler: EventHandler): void {
        console.info("STUB :: CastContext#removeEventListener");
    }

    // @ts-ignore
    public requestSession (): Promise<string> {
        console.info("STUB :: CastContext#requestSession");
    }

    public setOptions (options: CastOptions): void {
        console.info("STUB :: CastContext#setOptions");
    }
}
