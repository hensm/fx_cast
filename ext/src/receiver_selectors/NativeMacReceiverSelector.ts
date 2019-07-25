"use strict";

import bridge from "../lib/bridge";
import options from "../lib/options";

import ReceiverSelector, {
        ReceiverSelection
      , ReceiverSelectorEvents
      , ReceiverSelectorMediaType } from "./ReceiverSelector";

import { TypedEventTarget } from "../lib/typedEvents";
import { getWindowCenteredProps } from "../lib/utils";
import { Message, Receiver } from "../types";


const _ = browser.i18n.getMessage;


interface NativeReceiverSelectorSelectedMessage extends Message {
    subject: "main:/receiverSelector/selected";
    data: ReceiverSelection;
}

interface NativeReceiverSelectorCloseMessage extends Message {
    subject: "main:/receiverSelector/error";
    data: string;
}

interface NativeReceiverSelectorErrorMessage extends Message {
    subject: "main:/receiverSelector/error";
    data: string;
}


// TODO: Figure out lifetime properly
export default class NativeMacReceiverSelector
        extends TypedEventTarget<ReceiverSelectorEvents>
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

        this.bridgePort = await bridge.connect();

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


        // Current window to base centered position on
        const openerWindow = await browser.windows.getCurrent();
        const centeredProps = getWindowCenteredProps(openerWindow, 350, 0);

        this.bridgePort.postMessage({
            subject: "bridge:/receiverSelector/open"
          , data: JSON.stringify({
                receivers
              , defaultMediaType
              , availableMediaTypes

              , windowPositionX: centeredProps.left
              , windowPositionY: centeredProps.top

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
