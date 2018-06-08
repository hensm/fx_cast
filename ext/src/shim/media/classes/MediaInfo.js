"use strict";

import { StreamType } from "../enums";

export default class MediaInfo {
	constructor (contentId, contentType) {
		this.contentId = contentId;
		this.contentType = contentType;
		this.customData = {};
		this.duration = null;
		this.metadata = null;
		this.streamType = StreamType.BUFFERED;
		this.textTrackStyle = null;
		this.tracks = [];
	}
}
