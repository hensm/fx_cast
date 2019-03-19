"use strict";

import MediaInfo from "../../cast/media/classes/MediaInfo";

import RemotePlayerController from "./RemotePlayerController";


interface SavedPlayerState {
    mediaInfo: string;
    currentTime: number;
    isPaused: boolean;
}

export default class RemotePlayer {
    public canControlVolume = false;
    public canPause = false;
    public canSeek = false;
    public controller: RemotePlayerController = null;
    public currentTime = 0;
    public displayName = "";
    public displayStatus = "";
    public duration = 0;
    public imageUrl: string = null;
    public isConnected = false;
    public isMediaLoaded = false;
    public isMuted = false;
    public isPaused = false;
    public mediaInfo: MediaInfo = null;
    public playerState: string = null;
    public savedPlayerState: SavedPlayerState = null;
    public statusText = "";
    public title = "";
    public volumeLevel = 1;
}
