"use strict";

import React, { Component } from "react";
import ReactDOM             from "react-dom";

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


let winWidth = 350;
let winHeight = 200;

let frameHeight;
let frameWidth;


class App extends Component {
    constructor () {
        super();

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
    }

    async componentDidMount () {
        const { tabId, frameId } = await browser.runtime.sendMessage({
            subject: "getPopupShimInfo"
        });

        this.port = browser.tabs.connect(tabId, {
            name: "popup"
          , frameId
        });

        this.port.postMessage({
            subject: "popupReady"
        });

        this.port.onMessage.addListener(message => {
            switch (message.subject) {
                case "populateReceiverList": {
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

                case "close": {
                    window.close();

                    break;
                }
            }
        });
    }

    onCast (receiver) {
        this.setState({
            isLoading: true
        });

        this.port.postMessage({
            subject: "selectReceiver"
          , data: {
                receiver
              , selectedMedia: this.state.selectedMedia
            }
        });
    }

    onSelectChange (ev) {
        this.setState({
            selectedMedia: ev.target.value
        });
    }

    render () {
        const shareMedia =
                this.state.selectedMedia === "tab"
             || this.state.selectedMedia === "screen";

        return (
            <div>
                <div className="media-select">
                    Cast
                    <select value={this.state.selectedMedia}
                            onChange={this.onSelectChange.bind(this)}
                            className="media-select-dropdown">
                        <option value="app" disabled={shareMedia}>this site's app</option>
                        <option value="tab" disabled={!shareMedia}>Tab</option>
                        <option value="screen" disabled={!shareMedia}>Screen</option>
                    </select>
                    to:
                </div>
                <ul className="receivers">
                    { this.state.receivers.map((receiver, i) => {
                        return (
                           <Receiver receiver={receiver}
                                     onCast={this.onCast.bind(this)}
                                     isLoading={this.state.isLoading}
                                     key={i}/>
                        );
                    })}
                </ul>
            </div>
        );
    }
}

class Receiver extends Component {
    constructor () {
        super();

        this.state = {
            isLoading: false
          , ellipsis: ""
        };
    }

    onClick () {
        this.props.onCast(this.props.receiver);

        this.setState({
            isLoading: true
        });

        setInterval(() => {
            this.setState({
                ellipsis: do {
                         if (this.state.ellipsis === "")    ".";
                    else if (this.state.ellipsis === ".")   "..";
                    else if (this.state.ellipsis === "..")  "...";
                    else if (this.state.ellipsis === "...") "";
                }
            });

        }, 500);
    }

    render () {
        return (
            <li className="receiver">
                <div className="receiver-name">
                    { this.props.receiver.friendlyName }
                </div>
                <div className="receiver-address">
                    { `${this.props.receiver.address}:${this.props.receiver.port}` }
                </div>
                <div className="receiver-status">
                    { do {
                        if (this.props.receiver.currentApp) {
                            `- ${this.props.receiver.currentApp}`
                        }
                    }}
                </div>
                <button className="receiver-connect"
                        onClick={this.onClick.bind(this)}
                        disabled={this.props.isLoading}>
                    { do {
                        if (this.state.isLoading) {
                            _("popupCastingButtonLabel") +
                                (this.state.isLoading
                                    ? this.state.ellipsis
                                    : "" )
                        } else {
                            _("popupCastButtonLabel")
                        }
                    }}
                </button>
            </li>
        );
    }
}


ReactDOM.render(
    <App />
  , document.querySelector("#root"));
