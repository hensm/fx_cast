"use strict";

import * as cast from "../../cast";

import ActiveInputStateEventData from "./ActiveInputStateEventData";
import ApplicationMetadata from "./ApplicationMetadata";
import ApplicationMetadataEventData from "./ApplicationMetadataEventData";
import ApplicationStatusEventData from "./ApplicationStatusEventData";
import MediaSessionEventData from "./MediaSessionEventData";
import VolumeEventData from "./VolumeEventData";


type MessageListener = (namespace: string, message: string) => void;


export default class CastSession extends EventTarget {
    constructor (sessionObj: cast.Session, state: string) {
        super();
        console.info("STUB :: CastSession#constructor");
    }

    public addMessageListener (
            namespace: string
          , listener: MessageListener): void {

        console.info("STUB :: CastSession#addMessageListener");
    }

    public endSession (stopCasting: boolean): void {
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
    public loadMedia (loadRequest: cast.media.LoadRequest): Promise<string> {
        console.info("STUB :: CastSession#loadMedia");
    }

    public removeMessageListener (
            namespace: string
          , listener: MessageListener): void {

        console.info("STUB :: CastSession#removeMessageListener");
    }

    public sendMessage (
            namespace: string
            // @ts-ignore
          , data: any): Promise<string> {

        console.info("STUB :: CastSession#sendMessage");
    }

    // @ts-ignore
    public setMute (isMute: boolean): Promise<string> {
        console.info("STUB :: CastSession#setMute");
    }

    // @ts-ignore
    public setVolume (volume: number): Promise<string> {
        console.info("STUB :: CastSession#setVolume");
    }
}
