/* tslint:disable:max-line-length */
"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import { getNextEllipsis } from "../../lib/utils";
import { Message, Receiver } from "../../types";

import { ReceiverSelectorMediaType }
    from "../../receiver_selectors/ReceiverSelector";


const _ = browser.i18n.getMessage;

// macOS styles
browser.runtime.getPlatformInfo()
    .then(platformInfo => {
        if (platformInfo.os === "mac") {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "styles/mac.css";
            document.head.appendChild(link);
        }
    });


interface PopupAppState {
    receivers: Receiver[];
    mediaType: ReceiverSelectorMediaType;
    availableMediaTypes: ReceiverSelectorMediaType;
    isLoading: boolean;
}

class PopupApp extends Component<{}, PopupAppState> {
    private port: browser.runtime.Port;
    private win: browser.windows.Window;

    constructor (props: {}) {
        super(props);

        this.state = {
            receivers: []
          , mediaType: ReceiverSelectorMediaType.App
          , availableMediaTypes: ReceiverSelectorMediaType.App
          , isLoading: false
        };

        // Store window ref
        browser.windows.getCurrent().then(win => {
            this.win = win;
        });

        this.onSelectChange = this.onSelectChange.bind(this);
        this.onCast = this.onCast.bind(this);
    }

    public componentDidMount () {
        this.port = browser.runtime.connect({
            name: "popup"
        });

        this.port.onMessage.addListener((message: Message) => {
            switch (message.subject) {
                case "popup:/populateReceiverList": {
                    this.setState({
                        receivers: message.data.receivers
                      , mediaType: message.data.defaultMediaType
                      , availableMediaTypes: message.data.availableMediaTypes
                    });

                    break;
                }

                case "popup:/close": {
                    window.close();
                    break;
                }
            }
        });
    }

    public componentDidUpdate () {
        setTimeout(() => {
            // Fit window to content height
            const frameHeight = window.outerHeight - window.innerHeight;
            const windowHeight = document.body.clientHeight + frameHeight;

            browser.windows.update(this.win.id, {
                height: windowHeight
            });
        }, 1);
    }

    public render () {
        return (
            <div>
                <div className="media-select">
                    { _("popupMediaSelectCastLabel") }
                    <select value={ this.state.mediaType }
                            onChange={ this.onSelectChange }
                            className="media-select-dropdown">
                        <option value={ ReceiverSelectorMediaType.App }
                                disabled={ !(this.state.availableMediaTypes
                                        & ReceiverSelectorMediaType.App) }>
                            { _("popupMediaTypeApp") }
                        </option>
                        <option value={ ReceiverSelectorMediaType.Tab }
                                disabled={ !(this.state.availableMediaTypes
                                        & ReceiverSelectorMediaType.Tab) }>
                            { _("popupMediaTypeTab") }
                        </option>
                        <option value={ ReceiverSelectorMediaType.Screen }
                                disabled={ !(this.state.availableMediaTypes
                                        & ReceiverSelectorMediaType.Screen) }>
                            { _("popupMediaTypeScreen") }
                        </option>
                    </select>
                    { _("popupMediaSelectToLabel") }
                </div>
                <ul className="receivers">
                    { this.state.receivers && this.state.receivers.map(
                            (receiver, i) => (
                        <ReceiverEntry receiver={ receiver }
                                       onCast={ this.onCast }
                                       isLoading={ this.state.isLoading }
                                       key={ i }/> ))}
                </ul>
            </div>
        );
    }

    private onCast (receiver: Receiver) {
        this.setState({
            isLoading: true
        });

        this.port.postMessage({
            subject: "receiverSelector:/selected"
          , data: {
                receiver
              , mediaType: this.state.mediaType
            }
        });
    }

    private onSelectChange (ev: React.ChangeEvent<HTMLSelectElement>) {
        this.setState({
            mediaType: parseInt(ev.target.value)
        });
    }
}


interface ReceiverEntryProps {
    receiver: Receiver;
    isLoading: boolean;
    onCast (receiver: Receiver): void;
}

interface ReceiverEntryState {
    ellipsis: string;
    isLoading: boolean;
}

class ReceiverEntry extends Component<ReceiverEntryProps, ReceiverEntryState> {
    constructor (props: ReceiverEntryProps) {
        super(props);

        this.state = {
            isLoading: false
          , ellipsis: ""
        };

        this.handleCast = this.handleCast.bind(this);
    }

    public render () {
        return (
            <li className="receiver">
                <div className="receiver-name">
                    { this.props.receiver.friendlyName }
                </div>
                <div className="receiver-address">
                    { `${this.props.receiver.host}:${this.props.receiver.port}` }
                </div>
                <div className="receiver-status"></div>
                <button className="receiver-connect"
                        onClick={ this.handleCast }
                        disabled={this.props.isLoading}>
                    { this.state.isLoading
                        ? _("popupCastingButtonTitle"
                              , (this.state.isLoading
                                    ? this.state.ellipsis
                                    : ""))
                        : _("popupCastButtonTitle") }
                </button>
            </li>
        );
    }

    private handleCast () {
        this.props.onCast(this.props.receiver);

        this.setState({
            isLoading: true
        });

        setInterval(() => {
            this.setState(state => ({
                ellipsis: getNextEllipsis(state.ellipsis)
            }));

        }, 500);
    }
}


// Render after CSS has loaded
window.addEventListener("load", () => {
    ReactDOM.render(
        <PopupApp />
      , document.querySelector("#root"));
});
