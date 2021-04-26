"use strict";

import ReceiverDisplayStatus from "./ReceiverDisplayStatus";
import Volume from "./Volume";

import { Capability, ReceiverType } from "../enums";


// https://developers.google.com/cast/docs/reference/chrome/chrome.cast.Receiver
export default class Receiver {
    public displayStatus: (ReceiverDisplayStatus | null) = null;
    public isActiveInput: (boolean | null) = null;
    public receiverType: string = ReceiverType.CAST;

    constructor(
            public label: string
          , public friendlyName: string
          , public capabilities: Capability[] = []
          , public volume: (Volume | null) = null) {
    }
}
