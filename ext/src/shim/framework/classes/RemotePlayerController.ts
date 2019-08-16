"use strict";

import RemotePlayer from "./RemotePlayer";


export default class RemotePlayerController extends EventTarget {
    constructor (player: RemotePlayer) {
        super();
        console.info("STUB :: RemotePlayerController#constructor");
    }

    public getFormattedTime (timeInSec: number): string {
        const hours = Math.floor(timeInSec / 3600) % 24;
        const minutes = Math.floor(timeInSec / 60) % 60;
        const seconds = timeInSec % 60;

        return [ hours, minutes, seconds ]
            .map(c => c.toString().padStart(2, "0"))
            .join(":");
    }

    public getSeekPosition (currentTime: number, duration: number) {
        return (currentTime / duration) * 100;
    }

    public getSeekTime (currentPosition: number, duration: number) {
        return (duration / 100) * currentPosition;
    }

    public muteOrUnmute (): void {
        console.info("STUB :: RemotePlayerController#muteOrUnmute");
    }

    public playOrPause (): void {
        console.info("STUB :: RemotePlayerController#playOrPause");
    }

    public seek (): void {
        console.info("STUB :: RemotePlayerController#seek");
    }

    public setVolumeLevel (): void {
        console.info("STUB :: RemotePlayerController#setVolumeLevel");
    }

    public stop (): void {
        console.info("STUB :: RemotePlayerController#stop");
    }
}
