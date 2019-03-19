"use strict";

import Image from "../../cast/classes/Image";
import Receiver from "../../cast/classes/Receiver";
import Session from "../../cast/classes/Session";

import LoadRequest from "../../cast/media/classes/LoadRequest";
import Media from "../../cast/media/classes/Media";

import ActiveInputStateEventData from "./ActiveInputStateEventData";
import ApplicationMetadata from "./ApplicationMetadata";
import ApplicationMetadataEventData from "./ApplicationMetadataEventData";
import ApplicationStatusEventData from "./ApplicationStatusEventData";
import MediaSessionEventData from "./MediaSessionEventData";
import VolumeEventData from "./VolumeEventData";


type EventHandler = (eventData:
        ApplicationStatusEventData
      | ApplicationMetadataEventData
      | ActiveInputStateEventData
      | MediaSessionEventData
      | VolumeEventData) => void;

type MessageListener = (namespace: string, message: string) => void;


export default class RemotePlayer {
    constructor (sessionObj: Session, state: string) {
        console.info("STUB :: CastSession#constructor");
    }

    public addEventListener (
            type: string
          , handler: EventHandler): void {

        console.info("STUB :: CastSession#addEventListener");
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
    public getCastDevice (): Receiver {
        console.info("STUB :: CastSession#getCastDevice");
    }

    // @ts-ignore
    public getMediaSession (): Media {
        console.info("STUB :: CastSession#getMediaSession");
    }

    // @ts-ignore
    public getSessionId (): string {
        console.info("STUB :: CastSession#getSessionId");
    }

    // @ts-ignore
    public getSessionObj (): Session {
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
    public loadMedia (loadRequest: LoadRequest): Promise<string> {
        console.info("STUB :: CastSession#loadMedia");
    }

    public removeEventListener (
            type: string
          , handler: EventHandler): void {

        console.info("STUB :: CastSession#removeEventListener");
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
