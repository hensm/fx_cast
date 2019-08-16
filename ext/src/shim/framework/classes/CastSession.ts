"use strict";

import * as cast from "../../cast";

import ApplicationMetadata from "./ApplicationMetadata";


type MessageListener = (namespace: string, message: string) => void;


export default class CastSession extends EventTarget {
    constructor (_sessionObj: cast.Session, _state: string) {
        super();
        console.info("STUB :: CastSession#constructor");
    }

    public addMessageListener (
            _namespace: string
          , _listener: MessageListener): void {

        console.info("STUB :: CastSession#addMessageListener");
    }

    public endSession (_stopCasting: boolean): void {
        console.info("STUB :: CastSession#endSession");
    }

    // @ts-ignore
    public getActiveInputState (): number {
        console.info("STUB :: CastSession#getActiveInputState");
    }

    // @ts-ignore
    public getApplicationMetadata (): ApplicationMetadata {
        console.info("STUB :: CastSession#getApplicationMetadata");
    }

    // @ts-ignore
    public getApplicationStatus (): string {
        console.info("STUB :: CastSession#getApplicationStatus");
    }

    // @ts-ignore
    public getCastDevice (): cast.Receiver {
        console.info("STUB :: CastSession#getCastDevice");
    }

    // @ts-ignore
    public getMediaSession (): cast.media.Media {
        console.info("STUB :: CastSession#getMediaSession");
    }

    // @ts-ignore
    public getSessionId (): string {
        console.info("STUB :: CastSession#getSessionId");
    }

    // @ts-ignore
    public getSessionObj (): cast.Session {
        console.info("STUB :: CastSession#getSessionObj");
    }

    // @ts-ignore
    public getSessionState (): string {
        console.info("STUB :: CastSession#getSessionState");
    }

    // @ts-ignore
    public getVolume (): number {
        console.info("STUB :: CastSession#getVolume");
    }

    // @ts-ignore
    public isMute (): boolean {
        console.info("STUB :: CastSession#isMute");
    }

    // @ts-ignore
    public loadMedia (_loadRequest: cast.media.LoadRequest): Promise<string> {
        console.info("STUB :: CastSession#loadMedia");
    }

    public removeMessageListener (
            _namespace: string
          , _listener: MessageListener): void {

        console.info("STUB :: CastSession#removeMessageListener");
    }

    public sendMessage (
            _namespace: string
            // @ts-ignore
          , _data: any): Promise<string> {

        console.info("STUB :: CastSession#sendMessage");
    }

    // @ts-ignore
    public setMute (_isMute: boolean): Promise<string> {
        console.info("STUB :: CastSession#setMute");
    }

    // @ts-ignore
    public setVolume (_volume: number): Promise<string> {
        console.info("STUB :: CastSession#setVolume");
    }
}
