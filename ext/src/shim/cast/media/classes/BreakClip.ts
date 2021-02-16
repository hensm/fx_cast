"use strict";

import VastAdsRequest from "./VastAdsRequest";

import { HlsSegmentFormat } from "../enums";


export default class BreakClip {
    public clickThroughUrl?: string;
    public contentId?: string;
    public contentType?: string;
    public contentUrl?: string;
    public customData?: {};
    public duration?: number;
    public hlsSegmentFormat?: HlsSegmentFormat;
    public posterUrl?: string;
    public title?: string;
    public vastAdsRequest?: VastAdsRequest;
    public whenSkippable?: number;

    constructor(public id: string) {}
}
