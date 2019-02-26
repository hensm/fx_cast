declare const EXTENSION_NAME: string;
declare const EXTENSION_ID: string;
declare const EXTENSION_VERSION: string;
declare const MIRRORING_APP_ID: string;
declare const APPLICATION_NAME: string;
declare const APPLICATION_VERSION: string;

// Fix issues with @types/firefox-webext-browser
declare namespace browser.events {
    interface Event {
        addListener (...args: any[]): void;
    }
}
declare namespace browser.runtime {
    interface Port {
        error: { message: string };
    }
}
