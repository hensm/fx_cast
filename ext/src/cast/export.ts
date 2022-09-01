/* eslint-disable @typescript-eslint/no-namespace */
"use strict";

import type { TypedMessagePort } from "../lib/TypedMessagePort";
import type { Message } from "../messaging";

import pageMessenging from "./pageMessenging";
import CastSDK from "./sdk";

export type CastPort = TypedMessagePort<Message>;

let existingPort: CastPort;
let existingInstance = new CastSDK();

export default existingInstance;

/**
 * To support exporting the API from a module, we need to retain the
 * MessageChannel-based pageMessaging layer despite not crossing any
 * context boundaries.
 *
 * The ensureInit function creates a messaging connection to the
 * castManager, hooks it up to the pageMessaging layer and also provides
 * a messaging port so consumers of this module can communicate with the
 * castManager.
 */
export function ensureInit(contextTabId?: number): Promise<CastPort> {
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
             * port1 will handle castManager messages.
             * port2 will handle cast instance messages.
             */
            const { port1: managerPort, port2: instancePort } =
                new MessageChannel();

            /**
             * Provide castManager with a port to send messages to
             * cast instance.
             */
            if (contextTabId) {
                await castManager.createInstance(instancePort, {
                    tabId: contextTabId,
                    frameId: 0
                });
            } else {
                await castManager.createInstance(instancePort);
            }

            // castManager -> cast instance
            managerPort.addEventListener("message", ev => {
                const message = ev.data as Message;
                if (message.subject === "cast:initialized") {
                    if (message.data.isAvailable) {
                        resolve(existingPort);
                    } else {
                        reject();
                    }
                }

                pageMessenging.extension.sendMessage(message);
            });
            managerPort.start();

            // Cast instance -> castManager
            pageMessenging.extension.addListener(message => {
                managerPort.postMessage(message);
            });
        } else {
            // Let contentBridge hook up pageMessaging
            const { managerPort: backgroundPort } = await import(
                "./contentBridge"
            );
            existingPort = pageMessenging.page.messagePort;

            backgroundPort.onMessage.addListener(function onManagerMessage(
                message: Message
            ) {
                if (message.subject === "cast:initialized") {
                    if (message.data.isAvailable) {
                        resolve(pageMessenging.page.messagePort);
                    } else {
                        reject();
                    }

                    backgroundPort.onMessage.removeListener(onManagerMessage);
                }
            });
        }
    });
}
