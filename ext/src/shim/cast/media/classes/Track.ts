"use strict";

export default class Track {
    public customData: any = null;
    public language: (string | null) = null;
    public name: (string | null) = null;
    public subtype: (string | null) = null;
    public trackContentId: (string | null) = null;
    public trackContentType: (string | null) = null;

    constructor (
            public trackId: number
          , public type: string) {}
}
