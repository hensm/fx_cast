/* tslint:disable:max-line-length */
"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import { getNextEllipsis } from "../../lib/utils";
import * as types from "../../types";

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
    receivers: types.Receiver[];
    selectedMedia: string;
    isLoading: boolean;
}

class PopupApp extends Component<{}, PopupAppState> {
    private port: browser.runtime.Port;
    private win: browser.windows.Window;

    constructor (props: {}) {
        super(props);

        this.state = {
            receivers: []
          , selectedMedia: "app"
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
        const backgroundPort = browser.runtime.connect({
            name: "popup"
        });

        backgroundPort.onMessage.addListener((message: types.Message) => {
            if (message.subject === "popup:/assignShim") {
                this.setPort(message.data.tabId
                           , message.data.frameId);
            }
        });
    }

    public render () {
        const shareMedia =
                this.state.selectedMedia === "tab"
             || this.state.selectedMedia === "screen";

        return (
            <div>
                <div className="media-select">
                    Cast
                    <select value={ this.state.selectedMedia }
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
                           <Receiver receiver={ receiver }
                                     onCast={ this.onCast }
                                     isLoading={ this.state.isLoading }
                                     key={ i }/>
                        );
                    })}
                </ul>
            </div>
        );
    }

    private async setPort (shimTabId: number, shimFrameId: number) {
        if (this.port) {
            this.port.disconnect();
        }

        this.port = browser.tabs.connect(shimTabId, {
            name: "popup"
          , frameId: shimFrameId
        });

        this.port.postMessage({
            subject: "shim:/popupReady"
        });

        this.port.onMessage.addListener((message: types.Message) => {
            switch (message.subject) {
                case "popup:/populateReceiverList": {
                    this.setState({
                        receivers: message.data.receivers
                      , selectedMedia: message.data.selectedMedia
                    }, () => {
                        // Get height of content without window decoration
                        winHeight = document.body.clientHeight + frameHeight;

                        // Adjust height to fit content
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

    private onCast (receiver: types.Receiver) {
        this.setState({
            isLoading: true
        });

        this.port.postMessage({
            subject: "shim:/selectReceiver"
          , data: {
                receiver
              , selectedMedia: this.state.selectedMedia
              , a: 5
            }
        });
    }

    private onSelectChange (ev: React.ChangeEvent<HTMLSelectElement>) {
        this.setState({
            selectedMedia: ev.target.value
        });
    }
}


interface ReceiverProps {
    receiver: types.Receiver;
    isLoading: boolean;
    onCast (receiver: types.Receiver): void;
}

interface ReceiverState {
    ellipsis: string;
    isLoading: boolean;
}

class Receiver extends Component<ReceiverProps, ReceiverState> {
    constructor (props: ReceiverProps) {
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
                    { `${this.props.receiver.address}:${this.props.receiver.port}` }
                </div>
                <div className="receiver-status">
                    { this.props.receiver.currentApp &&
                        `- ${this.props.receiver.currentApp}` }
                </div>
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
