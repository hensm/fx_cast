"use strict";

export default class LiveSeekableRange {
    constructor(
            public start?: number
          , public end?: number
          , public isMovingWindow?: boolean
          , public isLiveDone?: boolean) {}
}
