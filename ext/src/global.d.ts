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
