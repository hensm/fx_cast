"use strict";

import CredentialsData from "./CredentialsData";
import Timeout from "./Timeout";

import { Capability } from "../enums";


// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.SessionRequest
export default class SessionRequest {
    public language: (string | null) = null;

    constructor (
            public appId: string
          , public capabilities = [ Capability.VIDEO_OUT
                                  , Capability.AUDIO_OUT ]
          , public requestSessionTimeout: number = (new Timeout()).requestSession
          , public androidReceiverCompatible = false
          , public credentialsData: (CredentialsData | null) = null) {}
}
