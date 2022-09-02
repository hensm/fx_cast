import type { TypedMessagePort } from "../lib/TypedMessagePort";
import messaging, { Message } from "../messaging";
import type { ReceiverDevice } from "../types";

import pageMessenging from "./pageMessenging";
import CastSDK from "./sdk";

export type CastPort = TypedMessagePort<Message>;

let existingPort: CastPort;
let existingInstance = new CastSDK();

export default existingInstance;

interface EnsureInitOpts {
    contextTabId?: number;
    /** Skip receiver selection. */
    receiverDevice?: ReceiverDevice;
}

/**
 * To support exporting the API from a module, we need to retain the
 * MessageChannel-based pageMessaging layer despite not crossing any
 * context boundaries.
 *
 * The ensureInit function creates a messaging connection to the
 * cast manager, hooks it up to the pageMessaging layer and also
 * provides a messaging port so consumers of this module can communicate
 * with the cast manager.
 */
export function ensureInit(opts: EnsureInitOpts): Promise<CastPort> {
    return new Promise(async (resolve, reject) => {
        // If already initialized
        if (existingPort) {
            existingPort.close();
            existingInstance = new CastSDK();
        }

        /**
         * If imported into a background script context, the location
         * will be the internal extension URL, whereas in a content
         * script, it will be the content page URL.
         */
        if (window.location.protocol === "moz-extension:") {
            const { default: castManager } = await import(
                "../background/castManager"
            );

            /**
             * port1 will handle cast manager messages.
             * port2 will handle cast instance messages.
             */
            const { port1: managerPort, port2: instancePort } =
                new MessageChannel();

            /**
             * Provide cast manager with a port to send messages to
             * cast instance.
             */
            if (opts.contextTabId) {
                await castManager.createInstance(instancePort, {
                    tabId: opts.contextTabId,
                    frameId: 0
                });
            } else {
                await castManager.createInstance(instancePort);
            }

            // cast manager -> cast instance
            managerPort.addEventListener("message", ev => {
                const message = ev.data as Message;
                if (message.subject === "cast:instanceCreated") {
                    if (message.data.isAvailable) {
                        resolve(existingPort);
                    } else {
                        reject();
                    }
                }

                pageMessenging.extension.sendMessage(message);
            });
            managerPort.start();

            // Cast instance -> cast manager
            pageMessenging.extension.addListener(message => {
                // Skip receiver selection
                if (opts.receiverDevice) {
                    message = rewriteTrustedRequestSession(
                        message,
                        opts.receiverDevice
                    );
                }

                managerPort.postMessage(message);
            });
        } else {
            const managerPort = messaging.connect({ name: "trusted-cast" });

            // Cast manager -> cast instance
            managerPort.onMessage.addListener(message => {
                if (message.subject === "cast:instanceCreated") {
                    if (message.data.isAvailable) {
                        resolve(pageMessenging.page.messagePort);
                    } else {
                        reject();
                    }
                }

                pageMessenging.extension.sendMessage(message);
            });

            // Cast instance -> cast manager
            pageMessenging.extension.addListener(message => {
                // Skip receiver selection
                if (opts.receiverDevice) {
                    message = rewriteTrustedRequestSession(
                        message,
                        opts.receiverDevice
                    );
                }

                managerPort.postMessage(message);
            });

            managerPort.onDisconnect.addListener(() => {
                pageMessenging.extension.close();
            });

            existingPort = pageMessenging.page.messagePort;
        }
    });
}

/**
 * If a receiver device was passed to `ensureInit`, messages to the cast
 * manager will be passed through this function and the receiver device
 * will be added to the message payload. This tells the cast manager to
 * skip receiver selection when requesting a session.
 */
function rewriteTrustedRequestSession(
    message: Message,
    receiverDevice: ReceiverDevice
) {
    if (message.subject !== "main:requestSession") return message;
    message.data.receiverDevice = receiverDevice;
    return message;
}
