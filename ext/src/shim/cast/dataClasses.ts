"use strict";

import Session from "./Session";

import { AutoJoinPolicy
       , Capability
       , DefaultActionPolicy
       , ReceiverType
       , VolumeControlType } from "./enums";


export class ApiConfig {
    constructor(
            public sessionRequest: SessionRequest
          , public sessionListener: (session: Session) => void
          , public receiverListener: (availability: string) => void

          , public autoJoinPolicy: string
                    = AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED
          , public defaultActionPolicy: string
                    = DefaultActionPolicy.CREATE_SESSION) {}
}


export class CredentialsData {
    constructor(
            public credentials: string
          , public credentialsData: string) {}
}


export class DialRequest {
    constructor(
            public appName: string
          , public launchParameter: (string | null) = null) {}
}


export class Error {
    constructor(
            public code: string
          , public description: (string | null) = null
          , public details: any = null) {}
}


export class Image {
    public width: (number | null) = null;
    public height: (number | null) = null;

    constructor(public url: string) {}
}


export class Receiver {
    public displayStatus: (ReceiverDisplayStatus | null) = null;
    public isActiveInput: (boolean | null) = null;
    public receiverType: string = ReceiverType.CAST;

    constructor(
            public label: string
          , public friendlyName: string
          , public capabilities: Capability[] = []
          , public volume: (Volume | null) = null) {}
}


export class ReceiverDisplayStatus {
    public showStop: (boolean | null) = null;

    constructor(
            public statusText: string
          , public appImages: Image[]) {}
}


export class SenderApplication {
    public packageId: (string | null) = null;
    public url: (string | null) = null;

    constructor(public platform: string) {}
}


export class SessionRequest {
    public language: (string | null) = null;

    constructor(
            public appId: string
          , public capabilities = [ Capability.VIDEO_OUT
                                  , Capability.AUDIO_OUT ]
          , public requestSessionTimeout = (new Timeout()).requestSession
          , public androidReceiverCompatible = false
          , public credentialsData: (CredentialsData | null) = null) {}
}


export class Timeout {
    public leaveSession = 3000;
    public requestSession = 60000;
    public sendCustomMessage = 3000;
    public setReceiverVolume = 3000;
    public stopSession = 3000;
}


export class Volume {
    public controlType?: VolumeControlType;
    public stepInterval?: number;

    constructor(
            public level: (number | null) = null
          , public muted: (boolean | null) = null) {}
}
