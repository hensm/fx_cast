"use strict";

import nativeMessaging from "../../lib/nativeMessaging";

import ReceiverSelectorManager, {
        ReceiverSelectorMediaType } from "../ReceiverSelectorManager";

import { Message, Receiver } from "../../types";

import { NativeReceiverSelectorCloseMessage
       , NativeReceiverSelectorErrorMessage
       , NativeReceiverSelectorSelectedMessage } from "../../messageTypes";


const _ = browser.i18n.getMessage;


export default class NativeMacReceiverSelectorManager
        extends EventTarget
        implements ReceiverSelectorManager {

    private bridgePort: browser.runtime.Port;
    private bridgePortDisconnected: boolean = false;

    private wasReceiverSelected: boolean = false;


    public async open (
            receivers: Receiver[]
          , defaultMediaType: ReceiverSelectorMediaType): Promise<void> {

        this.bridgePort = nativeMessaging.connectNative(APPLICATION_NAME);

        this.bridgePort.onMessage.addListener((message: Message) => {
            switch (message.subject) {
                case "main:/receiverSelector/selected": {
                    this.onBridgePortMessageSelected(
                            message as NativeReceiverSelectorSelectedMessage);
                    break;
                }
                case "main:/receiverSelector/error": {
                    this.onBridgePortMessageError(
                            message as NativeReceiverSelectorErrorMessage);
                    break;
                }
                case "main:/receiverSelector/close": {
                    this.onBridgePortMessageClose(
                            message as NativeReceiverSelectorCloseMessage);
                    break;
                }
            }
        });

        this.bridgePort.onDisconnect.addListener(() => {
            this.bridgePortDisconnected = true;
        });

        this.bridgePort.postMessage({
            subject: "bridge:/receiverSelector/open"
          , data: JSON.stringify({
                receivers
              , defaultMediaType
              , i18n_mediaTypeApp: _("popupMediaTypeApp")
              , i18n_mediaTypeTab: _("popupMediaTypeTab")
              , i18n_mediaTypeScreen: _("popupMediaTypeScreen")
              , i18n_mediaSelectCastLabel: _("popupMediaSelectCastLabel")
              , i18n_mediaSelectToLabel: _("popupMediaSelectToLabel")
            })
        });
    }

    public close (): void {
        if (this.bridgePort && !this.bridgePortDisconnected) {
            this.bridgePort.postMessage({
                subject: "bridge:/receiverSelector/close"
            });
        }
    }


    private onBridgePortMessageSelected (
            message: NativeReceiverSelectorSelectedMessage) {
        this.wasReceiverSelected = true;
        this.dispatchEvent(new CustomEvent("selected", {
            detail: message.data
        }));
    }

    private onBridgePortMessageError (
            message: NativeReceiverSelectorErrorMessage) {
        this.dispatchEvent(new CustomEvent("error"));
    }

    private onBridgePortMessageClose (
            message: NativeReceiverSelectorCloseMessage) {

        if (!this.wasReceiverSelected) {
            this.dispatchEvent(new CustomEvent("cancelled"));
        }

        if (!this.bridgePortDisconnected) {
            this.bridgePort.disconnect();
        }

        this.bridgePort = null;
        this.bridgePortDisconnected = false;
        this.wasReceiverSelected = false;
    }
}
