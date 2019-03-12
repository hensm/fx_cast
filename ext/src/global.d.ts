// Define replacement types
declare const EXTENSION_NAME: string;
declare const EXTENSION_ID: string;
declare const EXTENSION_VERSION: string;
declare const MIRRORING_APP_ID: string;
declare const APPLICATION_NAME: string;
declare const APPLICATION_VERSION: string;


declare interface Window {
    wrappedJSObject: typeof Window;
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
