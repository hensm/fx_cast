// Define replacement types
declare const MIRRORING_APP_ID: string;
declare const APPLICATION_NAME: string;
declare const APPLICATION_VERSION: string;


declare interface Object {
    // tslint:disable-next-line:ban-types
    wrappedJSObject: Object;
}

declare interface CanvasRenderingContext2D {
    DRAWWINDOW_DRAW_CARET: 0x01;
    DRAWWINDOW_DO_NOT_FLUSH: 0x02;
    DRAWWINDOW_DRAW_VIEW: 0x04;
    DRAWWINDOW_USE_WIDGET_LAYERS: 0x08;
    DRAWWINDOW_ASYNC_DECODE_IMAGES: 0x10;

    drawWindow (
            window: Window
          , x: number, y: number
          , w: number, h: number
          , bgColor: string
          , flags: number): void;
}

declare interface HTMLCanvasElement {
    captureStream (frameRate?: number): MediaStream;
}

declare interface MediaTrackConstraints {
    mediaSource: "screen" | "window";
}

declare interface RTCPeerConnection {
    addStream (mediaStream: MediaStream): void;
}


interface CloneIntoOptions {
    cloneFunctions?: boolean;
    wrapReflectors?: boolean;
}

declare function cloneInto<T> (
        obj: T
      , targetScope: Window
      , options?: CloneIntoOptions): T;


interface ExportFunctionOptions {
    defineAs: string;
    allowCallbacks?: boolean;
    allowCrossOriginArguments?: boolean;
}

type ExportFunctionFunc = (...args: any[]) => any;

declare function exportFunction (
        func: ExportFunctionFunc
      , targetScope: any
      , options?: ExportFunctionOptions): ExportFunctionFunc;



// Fix issues with @types/firefox-webext-browser
declare namespace browser.events {
    /**
     * Shouldn't enforce limited function signature across all
     * event types.
     */
    interface Event {
        addListener (...args: any[]): void | Promise<void>;
        removeListener (...args: any[]): void | Promise<void>;
    }
}

declare namespace browser.runtime {
    interface Port {
        error: { message: string };

        /**
         * https://git.io/fjmzb
         * addListener cb `() => void` is wrong
         */
        onMessage: browser.events.Event;
    }

    function connect (connectInfo: {
            name?: string
          , includeTlsChannelId?: boolean
        }): browser.runtime.Port;
}


// Allow default attribute on <button>
declare namespace React {
    interface ButtonHTMLAttributes<T> {
        default?: boolean;
    }
}

declare namespace JSX {
    interface IntrinsicElements {
        button: React.DetailedHTMLProps<
            React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
    }
}
