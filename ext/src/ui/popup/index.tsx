/* tslint:disable:max-line-length */
"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import knownApps from "../../lib/knownApps";
import options from "../../lib/options";

import { Message } from "../../messaging";
import { getNextEllipsis } from "../../lib/utils";
import { Receiver } from "../../types";

import { ReceiverSelectorMediaType } from "../../background/receiverSelector";


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

    filePath?: string;
    requestedAppId?: string;

    mirroringEnabled: boolean;
}

class PopupApp extends Component<{}, PopupAppState> {
    private port?: browser.runtime.Port;
    private win?: browser.windows.Window;
    private defaultMediaType?: ReceiverSelectorMediaType;

    constructor (props: {}) {
        super(props);

        this.state = {
            receivers: []
          , mediaType: ReceiverSelectorMediaType.App
          , availableMediaTypes: ReceiverSelectorMediaType.App
          , isLoading: false
          , mirroringEnabled: false
        };

        // Store window ref
        browser.windows.getCurrent().then(win => {
            this.win = win;
        });

        this.onSelectChange = this.onSelectChange.bind(this);
        this.onCast = this.onCast.bind(this);
        this.onStop = this.onStop.bind(this);
    }

    public async componentDidMount () {
        this.port = browser.runtime.connect({
            name: "popup"
        });

        this.port.onMessage.addListener((message: Message) => {
            switch (message.subject) {
                case "popup:/sendRequestedAppId": {
                    this.setState({
                        requestedAppId: message.data.requestedAppId
                    });

                    break;
                }

                case "popup:/populateReceiverList": {
                    const { receivers
                          , availableMediaTypes
                          , defaultMediaType } = message.data;

                    this.defaultMediaType = defaultMediaType;

                    this.setState({ receivers });

                    if (availableMediaTypes && defaultMediaType) {
                        this.setState({
                            availableMediaTypes: availableMediaTypes
                          , mediaType: defaultMediaType
                        });
                    }

                    break;
                }

                case "popup:/close": {
                    window.close();
                    break;
                }
            }
        });

        this.setState({
            mirroringEnabled: await options.get("mirroringEnabled")
        });
    }

    public componentDidUpdate () {
        setTimeout(() => {
            if (this.win?.id === undefined) {
                return;
            }

            // Fit window to content height
            const frameHeight = window.outerHeight - window.innerHeight;
            const windowHeight = document.body.clientHeight + frameHeight;

            browser.windows.update(this.win.id, {
                height: windowHeight
            });
        }, 1);
    }

    public render () {
        let truncatedFileName: string;

        if (this.state.filePath) {
            const filePath = this.state.filePath;
            const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);

            truncatedFileName = fileName.length > 12
                ? `${fileName.substring(0, 12)}...`
                : fileName;
        }

        const isAppMediaTypeSelected =
                this.state.mediaType === ReceiverSelectorMediaType.App;
        const isTabMediaTypeSelected =
                this.state.mediaType === ReceiverSelectorMediaType.Tab;
        const isScreenMediaTypeSelected =
                this.state.mediaType === ReceiverSelectorMediaType.Screen;

        const isSelectedMediaTypeAvailable =
                !!(this.state.availableMediaTypes & this.state.mediaType)

        return (
            <div>
                <div className="media-select">
                    <div className="media-select__label-cast">
                        { _("popupMediaSelectCastLabel") }
                    </div>
                    <div className="select-wrapper">
                        <select onChange={ this.onSelectChange }
                                className="media-select__dropdown"
                                disabled={ this.state.availableMediaTypes === 0 }>

                            <option value={ ReceiverSelectorMediaType.App }
                                    selected={ isAppMediaTypeSelected }
                                    disabled={ !(this.state.availableMediaTypes
                                            & ReceiverSelectorMediaType.App) }>
                                { (this.state.requestedAppId && knownApps[this.state.requestedAppId]?.name)
                                            ?? _("popupMediaTypeApp") }
                            </option>

                            { this.state.mirroringEnabled &&
                                <>
                                    <option value={ ReceiverSelectorMediaType.Tab }
                                            selected={ isTabMediaTypeSelected }
                                            disabled={ !(this.state.availableMediaTypes
                                                    & ReceiverSelectorMediaType.Tab) }>
                                        { _("popupMediaTypeTab") }
                                    </option>
                                    <option value={ ReceiverSelectorMediaType.Screen }
                                            selected={ isScreenMediaTypeSelected }
                                            disabled={ !(this.state.availableMediaTypes
                                                    & ReceiverSelectorMediaType.Screen) }>
                                        { _("popupMediaTypeScreen") }
                                    </option>
                                </> }
                        </select>
                    </div>
                    <div className="media-select__label-to">
                        { _("popupMediaSelectToLabel") }
                    </div>
                </div>
                <ul className="receivers">
                    { this.state.receivers && this.state.receivers.length
                        ? this.state.receivers.map((receiver, i) => (
                            <ReceiverEntry receiver={ receiver }
                                           onCast={ this.onCast }
                                           onStop={ this.onStop }
                                           isLoading={ this.state.isLoading }
                                           canCast={ isSelectedMediaTypeAvailable }
                                           key={ i } /> ))
                        : (
                            <div className="receivers__not-found">
                                { _("popupNoReceiversFound") }
                            </div> )}
                </ul>
            </div>
        );
    }

    private onCast (receiver: Receiver) {
        this.setState({
            isLoading: true
        });

        this.port?.postMessage({
            subject: "receiverSelector:/selected"
          , data: {
                receiver
              , mediaType: this.state.mediaType
              , filePath: this.state.filePath
            }
        });
    }

    private onStop (receiver: Receiver) {
        this.port?.postMessage({
            subject: "receiverSelector:/stop"
          , data: { receiver }
        });
    }

    private onSelectChange (ev: React.ChangeEvent<HTMLSelectElement>) {
        const mediaType = parseInt(ev.target.value);

        if (mediaType === ReceiverSelectorMediaType.File) {
            const fileUrl = window.prompt();
            if (fileUrl) {
                this.setState({
                    mediaType
                  , filePath: fileUrl
                });

                return;
            }

            // Set media type to default if failed to set filePath
            if (this.defaultMediaType) {
                this.setState({
                    mediaType: this.defaultMediaType
                });
            }
        } else {
            this.setState({
                mediaType
            });
        }

        this.setState({
            filePath: undefined
        });
    }
}


interface ReceiverEntryProps {
    receiver: Receiver;
    isLoading: boolean;
    canCast: boolean;
    onCast (receiver: Receiver): void;
    onStop (receiver: Receiver): void;
}

interface ReceiverEntryState {
    ellipsis: string;
    isLoading: boolean;
    showAlternateAction: boolean;
}

class ReceiverEntry extends Component<ReceiverEntryProps, ReceiverEntryState> {
    constructor (props: ReceiverEntryProps) {
        super(props);

        this.state = {
            ellipsis: ""
          , isLoading: false
          , showAlternateAction: false
        };

        const handleActionKeyEvents = (ev: KeyboardEvent) => {
            if (ev.key === "Alt" || ev.key === "Shift") {
                this.setState({
                    // Only enable on keydown, otherwise disable
                    showAlternateAction: ev.type === "keydown"
                });
            }
        };

        window.addEventListener("keydown", handleActionKeyEvents);
        window.addEventListener("keyup", handleActionKeyEvents);

        window.addEventListener("blur", () => {
            this.setState({
                showAlternateAction: false
            });
        });


        this.handleCast = this.handleCast.bind(this);
    }

    public render () {
        if (!this.props.receiver.status) {
            return;
        }

        const { application } = this.props.receiver.status;

        return (
            <li className="receiver">
                <div className="receiver__name">
                    { this.props.receiver.friendlyName }
                </div>
                <div className="receiver__address"
                     title={ !application.isIdleScreen ? application.statusText : "" }>
                    { application.isIdleScreen
                        ? `${this.props.receiver.host}:${this.props.receiver.port}`
                        : application.statusText }
                </div>
                <button className="button receiver__connect"
                        onClick={ this.handleCast }
                        disabled={ this.state.showAlternateAction
                            ? application.isIdleScreen
                            : (this.props.isLoading || !this.props.canCast) }>
                    { this.state.isLoading
                        ? _("popupCastingButtonTitle"
                              , (this.state.isLoading
                                    ? this.state.ellipsis
                                    : ""))
                        : this.state.showAlternateAction
                            ? _("popupStopButtonTitle")
                            : _("popupCastButtonTitle") }
                </button>
            </li>
        );
    }

    private handleCast () {
        if (!this.props.receiver.status) {
            return;
        }

        const { application } = this.props.receiver.status;

        if (!application.isIdleScreen && this.state.showAlternateAction) {
            this.props.onStop(this.props.receiver);
        } else {
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
}


// Render after CSS has loaded
window.addEventListener("load", () => {
    ReactDOM.render(
        <PopupApp />
      , document.querySelector("#root"));
});

window.addEventListener("contextmenu", () => {
    browser.menus.overrideContext({
        showDefaults: false
    });
});
