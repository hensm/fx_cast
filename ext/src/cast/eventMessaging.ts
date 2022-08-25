"use strict";

import logger from "../lib/logger";
import type { Message } from "../messaging";

type EventMessengerListener = (message: Message) => void;

/**
 * Messenger class for cross-context messages via CustomEvent.
 *
 * Supplied with an incoming and outgoing event name, it provides a
 * message channel from content scripts to page scripts provided that
 * the opposite event names are used with instances on either side.
 *
 * Note:
 * Extending EventTarget seems to cause issues with dispatching custom
 * events in WebExtension content scripts (sandbox issue?), so custom
 * addListener/removeListener methods are used instead.
 */
abstract class EventMessenger {
    private listeners = new Set<EventMessengerListener>();

    constructor(
        private incomingMessageEventName: string,
        private outgoingMessageEventName: string
    ) {
        // @ts-ignore
        document.addEventListener(
            this.incomingMessageEventName,
            (ev: CustomEvent<string>) => {
                for (const listener of this.listeners) {
                    listener(JSON.parse(ev.detail));
                }
            }
        );
    }

    addListener(listener: EventMessengerListener) {
        this.listeners.add(listener);
    }
    removeListener(listener: EventMessengerListener) {
        this.listeners.delete(listener);
    }

    sendMessage(message: Message) {
        document.dispatchEvent(
            new CustomEvent<string>(this.outgoingMessageEventName, {
                detail: JSON.stringify(message)
            })
        );
    }
}

const EV_TO_PAGE = "__castMessage";
const EV_FROM_PAGE = "__castMessageResponse";

export class PageEventMessenger extends EventMessenger {
    constructor() {
        super(EV_TO_PAGE, EV_FROM_PAGE);
    }
}
export class ExtensionEventMessenger extends EventMessenger {
    constructor() {
        super(EV_FROM_PAGE, EV_TO_PAGE);
    }
}

// Ensure only one instance of the type initially created is used
let messenger: EventMessenger;
function getMessenger(messengerType: { new (): EventMessenger }) {
    if (!messenger) {
        messenger = new messengerType();
    } else if (!(messenger instanceof messengerType)) {
        throw logger.error(
            "Requested messenger does not match type of instantiated messenger!"
        );
    }

    return messenger;
}

export default {
    /** Event messenger for page scripts. */
    get page() {
        return getMessenger(PageEventMessenger);
    },

    /** Event messenger for extension content scripts. */
    get extension() {
        return getMessenger(ExtensionEventMessenger);
    }
};
