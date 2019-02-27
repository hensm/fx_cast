// Define replacement types
declare const EXTENSION_NAME: string;
declare const EXTENSION_ID: string;
declare const EXTENSION_VERSION: string;
declare const MIRRORING_APP_ID: string;
declare const APPLICATION_NAME: string;
declare const APPLICATION_VERSION: string;


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
