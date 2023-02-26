import type { TypedMessagePort } from "../lib/TypedMessagePort";
import type { Message } from "../messaging";

const INIT_MESSAGE = "__pageMessenger_init__";

/** Strip anything non-serializable for message channel. */
function simplify(input: any) {
    return JSON.parse(JSON.stringify(input));
}

type MessengerListener = (message: Message) => void;

/**
 * Abstract messenger class for cross-context messages via
 * MessageChannel.
 *
 * Facilitates a message channel between page scripts running in the
 * page script context and the extension scripts running in the
 * sandboxed content script context.
 */
abstract class Messenger {
    private listeners = new Set<MessengerListener>();

    protected onMessage = (ev: MessageEvent<Message>) => {
        for (const listener of this.listeners) {
            listener(simplify(ev.data));
        }
    };

    addListener(listener: MessengerListener) {
        this.listeners.add(listener);
    }
    removeListener(listener: MessengerListener) {
        this.listeners.delete(listener);
    }

    /** Sends a message across the  */
    abstract sendMessage(message: Message): void;

    close() {
        this.listeners.clear();
    }
}

/**
 * Page-side of page script messaging.
 *
 * Creates a message channel, then sends an INIT_MESSAGE window message
 * with a port that is handled by an ExtensionScriptMessenger in the
 * content script.
 */
export class PageScriptMessenger extends Messenger {
    private port: TypedMessagePort<Message>;

    constructor() {
        super();

        // Create message channel and send port2 to
        const { port1, port2 } = new MessageChannel();
        window.postMessage(INIT_MESSAGE, window.location.href, [port2]);

        this.port = port1;
        this.port.addEventListener("message", this.onMessage);
        this.port.start();
    }

    sendMessage(message: Message) {
        this.port.postMessage(simplify(message));
    }
    get messagePort() {
        return this.port;
    }

    close() {
        super.close();
        this.port.removeEventListener("message", this.onMessage);
        this.port.close();
    }
}

/**
 * Extension-side of page script messaging.
 *
 * Listens for a INIT_MESSAGE window message from a PageScriptMessenger
 * running in a page script and establishes a message channel connection
 * once received.
 */
export class ExtensionScriptMessenger extends Messenger {
    private port?: TypedMessagePort<Message>;

    constructor() {
        super();
        window.addEventListener("message", this.onWindowMessage);
    }

    /** Handles init message from window and stores transferred port. */
    private onWindowMessage = (ev: MessageEvent<any>) => {
        if (ev.source !== window || ev.data !== INIT_MESSAGE) return;

        window.removeEventListener("message", this.onWindowMessage);

        this.port = ev.ports[0];
        this.port.addEventListener("message", ev => this.onMessage(ev));
        this.port.start();
    };

    sendMessage(message: Message) {
        this.port?.postMessage(simplify(message));
    }

    close() {
        super.close();

        window.removeEventListener("message", this.onWindowMessage);
        this.port?.removeEventListener("message", this.onMessage);
        this.port?.close();
    }
}

let pageMessenger: Nullable<PageScriptMessenger> = null;
let extensionMessenger: Nullable<ExtensionScriptMessenger> = null;

export default {
    /** Messenger for page scripts. */
    get page() {
        if (!pageMessenger) {
            pageMessenger = new PageScriptMessenger();
        }

        return pageMessenger;
    },

    /** Messenger for extension scripts. */
    get extension() {
        if (!extensionMessenger) {
            extensionMessenger = new ExtensionScriptMessenger();
        }
        return extensionMessenger;
    }
};
