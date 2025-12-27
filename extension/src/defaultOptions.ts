import type { WhitelistItemData } from "./background/whitelist";

export interface Options {
    /** Native messaging host name. */
    bridgeApplicationName: string;

    /** Attempt to connect to daemon if native messaging fails. */
    bridgeBackupEnabled: boolean;
    /** Daemon WebSocket server host. */
    bridgeBackupHost: string;
    /** Daemon WebSocket server port. */
    bridgeBackupPort: number;
    /** Whether daemon WebSocket server uses HTTPS. */
    bridgeBackupSecure: boolean;
    /** Daemon password. */
    bridgeBackupPassword: string;

    /** HTML5 media/image casting. */
    mediaEnabled: boolean;
    /** Sync media element state with remote media. */
    mediaSyncElement: boolean;
    /** Stop media cast session if page is closed. */
    mediaStopOnUnload: boolean;
    /** Casting for media on local filesystem. */
    localMediaEnabled: boolean;
    /** HTTP server port for local media. */
    localMediaServerPort: number;

    /** Screen mirroring casting. */
    mirroringEnabled: boolean;
    /** Chromecast receiver app ID for mirroring. */
    mirroringAppId: string;
    /** Max frame rate for mirroring WebRTC media stream. */
    mirroringStreamMaxFrameRate: number;
    /** Max bitrate for mirroring WebRTC media stream. */
    mirroringStreamMaxBitRate: number;
    /**
     * Base `scaleResolutionDownBy` parameter for mirroring WebRTC media
     * stream.
     */
    mirroringStreamDownscaleFactor: number;
    /** Max width/height to use for calculating final
     * `scaleResolutionDownBy` parameter for mirroring WebRTC media
     * stream.
     */
    mirroringStreamMaxResolution: { width?: number; height?: number };
    /** Whether to apply max resolution limits to mirroring WebRTC media
     * stream.
     */
    mirroringStreamUseMaxResolution: boolean;

    /**
     * Close receiver selector popup if another browser window is
     * focused.
     */
    receiverSelectorCloseIfFocusLost: boolean;
    /** Close receiver selector after a session is established. */
    receiverSelectorWaitForConnection: boolean;
    /** Auto-expand active sessions managed by the extension. */
    receiverSelectorExpandActive: boolean;
    /** Show media images in receiver selector. */
    receiverSelectorShowMediaImages: boolean;

    /** User agent replacement whitelist enabled. */
    siteWhitelistEnabled: boolean;
    /** User agent replacement whitelist items data. */
    siteWhitelist: WhitelistItemData[];
    /** Custom user agent string for whitelist. */
    siteWhitelistCustomUserAgent: string;

    /** Show advanced options on options page. */
    showAdvancedOptions: boolean;

    [key: string]: Options[keyof Options];
}

export default {
    bridgeApplicationName: BRIDGE_NAME,
    bridgeBackupEnabled: false,
    bridgeBackupHost: "localhost",
    bridgeBackupPort: 9556,
    bridgeBackupSecure: false,
    bridgeBackupPassword: "",

    mediaEnabled: true,
    mediaSyncElement: false,
    mediaStopOnUnload: false,
    localMediaEnabled: true,
    localMediaServerPort: 9555,

    mirroringEnabled: false,
    mirroringAppId: MIRRORING_APP_ID,
    mirroringStreamMaxFrameRate: 15,
    mirroringStreamMaxBitRate: 1000000,
    mirroringStreamDownscaleFactor: 1.0,
    mirroringStreamMaxResolution: { width: 1920, height: 1080 },
    mirroringStreamUseMaxResolution: true,

    receiverSelectorCloseIfFocusLost: true,
    receiverSelectorWaitForConnection: true,
    receiverSelectorExpandActive: true,
    receiverSelectorShowMediaImages: false,

    siteWhitelistEnabled: true,
    siteWhitelist: [{ pattern: "https://www.netflix.com/*", isEnabled: true }],
    siteWhitelistCustomUserAgent: "",

    showAdvancedOptions: false
} satisfies Options as Options;
