"use strict";

import Image from "../../classes/Image";
import MediaMetadata from "../classes/MediaMetadata";

import { ContainerType } from "../enums";


export default class ContainerMetadata {
    public containerDuration?: number;
    public containerImages?: Image[];
    public sections?: MediaMetadata[];
    public title?: string;

    constructor (public containerType: ContainerType
                        = ContainerType.GENERIC_CONTAINER) {}
}
