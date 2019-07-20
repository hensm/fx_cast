"use strict";

import nativeMessaging from "../lib/nativeMessaging";
import options from "../lib/options";

import ReceiverSelector, {
        ReceiverSelectorMediaType } from "./ReceiverSelector";

import { Message, Receiver } from "../types";

import { NativeReceiverSelectorCloseMessage
       , NativeReceiverSelectorErrorMessage
       , NativeReceiverSelectorSelectedMessage } from "../messageTypes";


const _ = browser.i18n.getMessage;


// TODO: Figure out lifetime properly
export default class NativeMacReceiverSelector
        extends EventTarget
        implements ReceiverSelector {

    private bridgePort: browser.runtime.Port;
    private wasReceiverSelected: boolean = false;
    private _isOpen: boolean = false;

    get isOpen () {
        return this._isOpen;
    }

    public async open (
            receivers: Receiver[]
          , defaultMediaType: ReceiverSelectorMediaType
          , availableMediaTypes: ReceiverSelectorMediaType): Promise<void> {

        const applicationName = await options.get("bridgeApplicationName");
        this.bridgePort = nativeMessaging.connectNative(applicationName);

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
            this.bridgePort = null;
            this.wasReceiverSelected = false;
            this._isOpen = false;
        });

        this.bridgePort.postMessage({
            subject: "bridge:/receiverSelector/open"
          , data: JSON.stringify({
                receivers
              , defaultMediaType
              , availableMediaTypes

              , i18n_extensionName: _("extensionName")
              , i18n_castButtonTitle: _("popupCastButtonTitle")
              , i18n_mediaTypeApp: _("popupMediaTypeApp")
              , i18n_mediaTypeTab: _("popupMediaTypeTab")
              , i18n_mediaTypeScreen: _("popupMediaTypeScreen")
              , i18n_mediaTypeFile: _("popupMediaTypeFile")
              , i18n_mediaSelectCastLabel: _("popupMediaSelectCastLabel")
              , i18n_mediaSelectToLabel: _("popupMediaSelectToLabel")
            })
        });

        this._isOpen = true;
    }

    public close (): void {
        if (this.bridgePort) {
            this.bridgePort.postMessage({
                subject: "bridge:/receiverSelector/close"
            });
        }

        this._isOpen = false;
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

        if (this.bridgePort) {
            this.bridgePort.disconnect();
        }

        this.bridgePort = null;
        this.wasReceiverSelected = false;
        this._isOpen = false;
    }
}
