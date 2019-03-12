"use strict";

import Volume from "../../cast/classes/Volume";


export default class VolumeRequest {
    public customData: any = null;

    constructor (
            public volume: Volume) {}
}
