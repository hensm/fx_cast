"use strict";

export default class Track {
    public customData: any = null;
    public language: string = null;
    public name: string = null;
    public subtype: string = null;
    public trackContentId: string = null;
    public trackContentType: string = null;

    constructor (
            public trackId: number
          , public type: string) {}
}
