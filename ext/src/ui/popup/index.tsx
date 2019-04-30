/* tslint:disable:max-line-length */
"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import { getNextEllipsis } from "../../lib/utils";
import { Message, Receiver } from "../../types";

import { ReceiverSelectorMediaType }
    from "../../receiverSelectorManager/ReceiverSelectorManager";


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


const winWidth = 350;
let winHeight = 200;

let frameHeight: number;
let frameWidth: number;


interface PopupAppState {
    receivers: Receiver[];
    defaultMediaType: ReceiverSelectorMediaType;
    isLoading: boolean;
}

class PopupApp extends Component<{}, PopupAppState> {
    private port: browser.runtime.Port;
    private win: browser.windows.Window;

    constructor (props: {}) {
        super(props);

        this.state = {
            receivers: []
          , defaultMediaType: ReceiverSelectorMediaType.App
          , isLoading: false
        };

        // Store window ref
        browser.windows.getCurrent().then(win => {
            this.win = win;
            frameHeight = win.height - window.innerHeight;
            frameWidth = win.width - window.innerWidth;
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
                      , defaultMediaType: message.data.defaultMediaType
                    }, () => {
                        // Get height of content without window decoration
                        winHeight = document.body.clientHeight + frameHeight;

                        browser.windows.update(this.win.id, {
                            height: winHeight
                        });
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

    public render () {
        const shareMedia =
                this.state.defaultMediaType === ReceiverSelectorMediaType.Tab
             || this.state.defaultMediaType === ReceiverSelectorMediaType.Screen;

        return (
            <div>
                <div className="media-select">
                    Cast
                    <select value={ this.state.defaultMediaType }
                            onChange={ this.onSelectChange }
                            className="media-select-dropdown">
                        <option value="app" disabled={ shareMedia }>this site's app</option>
                        <option value="tab" disabled={ !shareMedia }>Tab</option>
                        <option value="screen" disabled={ !shareMedia }>Screen</option>
                    </select>
                    to:
                </div>
                <ul className="receivers">
                    { this.state.receivers.map((receiver, i) => {
                        return (
                           <ReceiverEntry receiver={ receiver }
                                          onCast={ this.onCast }
                                          isLoading={ this.state.isLoading }
                                          key={ i }/>
                        );
                    })}
                </ul>
            </div>
        );
    }

    private onCast (receiver: Receiver) {
        this.setState({
            isLoading: true
        });

        this.port.postMessage({
            subject: "receiverSelectorManager:/selected"
          , data: {
                receiver
              , defaultMediaType: this.state.defaultMediaType
            }
        });
    }

    private onSelectChange (ev: React.ChangeEvent<HTMLSelectElement>) {
        const mediaTypeMap: { [key: string]: ReceiverSelectorMediaType } = {
            "app": ReceiverSelectorMediaType.App
          , "tab": ReceiverSelectorMediaType.Tab
          , "screen": ReceiverSelectorMediaType.Screen
        };

        this.setState({
            defaultMediaType: mediaTypeMap[ev.target.value]
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
                        ? _("popupCastingButtonLabel") +
                            (this.state.isLoading
                                ? this.state.ellipsis
                                : "")
                        : _("popupCastButtonLabel") }
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


ReactDOM.render(
    <PopupApp />
  , document.querySelector("#root"));
