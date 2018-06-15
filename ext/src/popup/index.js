"use strict";

import React, { Component } from "react";
import ReactDOM             from "react-dom";

const _ = browser.i18n.getMessage;

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

    componentDidMount () {
        browser.runtime.sendMessage({
            subject: "shim:popupReady"
        });

        browser.runtime.onMessage.addListener(message => {
            switch (message.subject) {
                case "popup:populate":
                    this.setState({
                        receivers: message.data.receivers
                      , selectedMedia: message.data.selectedMedia
                    });

                    winHeight = document.body.clientHeight + frameHeight;

                    browser.windows.update(this.win.id, {
                        height: winHeight
                    });

                    break;

                case "popup:close":
                    window.close();
                    break;
            }
        });
    }

    onCast (receiver) {
        this.setState({
            isLoading: true
        });

        browser.runtime.sendMessage({
            subject: "shim:selectReceiver"
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
                    <select value={this.state.selectedMedia} onChange={this.onSelectChange.bind(this)} className="media-select-dropdown">
                        <option value="app" disabled={shareMedia}>this site's app</option>
                        <option value="tab" disabled={!shareMedia}>Tab</option>
                        <option value="screen" disabled={!shareMedia}>Screen</option>
                    </select>
                    to:
                </div>
                <ul className="receivers">
                    { this.state.receivers.map(receiver => {
                        return (
                           <Receiver receiver={receiver}
                                     onCast={this.onCast.bind(this)}
                                     isLoading={this.state.isLoading} />
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
                    { `${this.props.receiver._address}:${this.props.receiver._port}` }
                </div>
                <button className="receiver-connect"
                        onClick={this.onClick.bind(this)}
                        disabled={this.props.isLoading}>
                    { do {
                        if (this.state.isLoading) {
                            _("popup_casting_button_label") +
                                (this.state.isLoading
                                    ? this.state.ellipsis
                                    : "" )
                        } else {
                            _("popup_cast_button_label")
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
