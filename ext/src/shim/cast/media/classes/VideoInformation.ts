"use strict";

import { HdrType } from "../enums";


export default class VideoInformation {
    constructor (public width: number
               , public height: number
               , public hdrType: HdrType) {}
}
