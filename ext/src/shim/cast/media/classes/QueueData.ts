"use strict";

import QueueItem from "./QueueItem";

import { RepeatMode } from "../enums";


export default class QueueData {
    public shuffle = false;

    constructor(public id?: string
              , public name?: string
              , public description?: string
              , public repeatMode?: RepeatMode
              , public items?: QueueItem[]
              , public startIndex?: number
              , public startTime?: number) {}
}
