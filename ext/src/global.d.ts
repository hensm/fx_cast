/* eslint-disable @typescript-eslint/no-unused-vars */

declare const BRIDGE_VERSION: string;
declare const BRIDGE_NAME: string;
declare const MIRRORING_APP_ID: string;

declare type Nullable<T> = T | null;

declare type DistributiveOmit<T, K extends keyof any> = T extends any
    ? Omit<T, K>
    : never;

declare interface Object {
    // eslint-disable-next-line @typescript-eslint/ban-types
    wrappedJSObject: Object;
}

declare interface CanvasRenderingContext2D {
    DRAWWINDOW_DRAW_CARET: 0x01;
    DRAWWINDOW_DO_NOT_FLUSH: 0x02;
    DRAWWINDOW_DRAW_VIEW: 0x04;
    DRAWWINDOW_USE_WIDGET_LAYERS: 0x08;
    DRAWWINDOW_ASYNC_DECODE_IMAGES: 0x10;

    drawWindow(
        window: Window,
        x: number,
        y: number,
        w: number,
        h: number,
        bgColor: string,
        flags: number
    ): void;
}

declare interface HTMLCanvasElement {
    captureStream(frameRate?: number): MediaStream;
}

declare interface MediaTrackConstraints {
    cursor: "always" | "motion" | "never";
}

declare interface RTCPeerConnection {
    addStream(mediaStream: MediaStream): void;
}

declare interface MediaDevices {
    getDisplayMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
}

interface CloneIntoOptions {
    cloneFunctions?: boolean;
    wrapReflectors?: boolean;
}

declare function cloneInto<T>(
    obj: T,
    targetScope: Window,
    options?: CloneIntoOptions
): T;

interface ExportFunctionOptions {
    defineAs: string;
    allowCallbacks?: boolean;
    allowCrossOriginArguments?: boolean;
}

type ExportFunctionFunc = (...args: any[]) => any;

declare function exportFunction(
    func: ExportFunctionFunc,
    targetScope: Window,
    options?: ExportFunctionOptions
): ExportFunctionFunc;

// Fix issues with @types/firefox-webext-browser
declare namespace browser.events {
    /**
     * Shouldn't enforce limited function signature across all
     * event types.
     */
    interface Event {
        addListener(...args: any[]): void | Promise<void>;
        removeListener(...args: any[]): void | Promise<void>;
    }
}

declare namespace browser.runtime {
    interface Port {
        error?: { message: string };

        /**
         * https://git.io/fjmzb
         * addListener cb `() => void` is wrong
         */
        onMessage: browser.events.Event;
    }

    function connect(connectInfo: {
        name?: string;
        includeTlsChannelId?: boolean;
    }): browser.runtime.Port;
}
