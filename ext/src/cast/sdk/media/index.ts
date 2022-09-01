"use strict";

export * from "./enums";
export * from "./classes";

export { default as Media } from "./Media";

export const DEFAULT_MEDIA_RECEIVER_APP_ID = "CC1AD845";

export const timeout = {
    editTracksInfo: 0,
    getStatus: 0,
    load: 0,
    pause: 0,
    play: 0,
    queue: 0,
    seek: 0,
    setVolume: 0,
    stop: 0
};
