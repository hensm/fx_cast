"use strict";

export default class Break {
    public duration?: number;
    public isEmbedded?: boolean;
    public isWatched = false;

    constructor(public id: string
              , public breakClipIds: string[]
              , public position: number) {}
}
