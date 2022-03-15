/* eslint-disable max-len */
"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import knownApps from "../../cast/knownApps";
import options from "../../lib/options";

import messaging, { Message, Port } from "../../messaging";
import { getNextEllipsis } from "../../lib/utils";
import { ReceiverDevice } from "../../types";

import {
    ReceiverSelectionActionType,
    ReceiverSelectorMediaType
} from "../../background/receiverSelector";

const _ = browser.i18n.getMessage;

// macOS styles
browser.runtime.getPlatformInfo().then(platformInfo => {
    if (platformInfo.os === "mac") {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "styles/mac.css";
        document.head.appendChild(link);
    }
});

interface PopupAppProps {}
interface PopupAppState {
    receivers: ReceiverDevice[];
    mediaType: ReceiverSelectorMediaType;
    availableMediaTypes: ReceiverSelectorMediaType;
    isLoading: boolean;

    filePath?: string;
    appId?: string;

    mirroringEnabled: boolean;
}

class PopupApp extends Component<PopupAppProps, PopupAppState> {
    private port?: Port;
    private win?: browser.windows.Window;
    private defaultMediaType?: ReceiverSelectorMediaType;

    constructor(props: PopupAppProps) {
        super(props);

        this.state = {
            receivers: [],
            mediaType: ReceiverSelectorMediaType.App,
            availableMediaTypes: ReceiverSelectorMediaType.App,
            isLoading: false,
            mirroringEnabled: false
        };

        // Store window ref
        browser.windows.getCurrent().then(win => {
            this.win = win;
        });

        new ResizeObserver(() => {
            this.updateWindowHeight();
        }).observe(document.body);

        this.onSelectChange = this.onSelectChange.bind(this);
        this.onCast = this.onCast.bind(this);
        this.onStop = this.onStop.bind(this);
    }

    public updateWindowHeight() {
        if (this.win?.id === undefined) {
            return;
        }

        const frameHeight = window.outerHeight - window.innerHeight;
        const windowHeight = document.body.clientHeight + frameHeight;

        browser.windows.update(this.win.id, {
            height: windowHeight
        });
    }

    public async componentDidMount() {
        this.port = messaging.connect({ name: "popup" });

        this.port.onMessage.addListener((message: Message) => {
            switch (message.subject) {
                case "popup:init": {
                    this.setState({
                        appId: message.data?.appId
                    });

                    break;
                }

                case "popup:update": {
                    const { receivers, availableMediaTypes, defaultMediaType } =
                        message.data;

                    this.setState({ receivers });

                    if (
                        availableMediaTypes !== undefined &&
                        defaultMediaType !== undefined
                    ) {
                        this.defaultMediaType = defaultMediaType;
                        this.setState({
                            availableMediaTypes,
                            mediaType: defaultMediaType
                        });
                    }

                    break;
                }

                case "popup:close": {
                    window.close();
                    break;
                }
            }
        });

        this.setState({
            mirroringEnabled: await options.get("mirroringEnabled")
        });
    }

    public componentDidUpdate() {
        setTimeout(() => {
            this.updateWindowHeight();
        }, 1);
    }

    public render() {
        /*

        // TODO: Add file support back to popup

        let truncatedFileName: string;

        if (this.state.filePath) {
            const filePath = this.state.filePath;
            const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);

            truncatedFileName = fileName.length > 12
                ? `${fileName.substring(0, 12)}...`
                : fileName;
        }
        */

        const isAppMediaTypeSelected =
            this.state.mediaType === ReceiverSelectorMediaType.App;
        const isTabMediaTypeSelected =
            this.state.mediaType === ReceiverSelectorMediaType.Tab;
        const isScreenMediaTypeSelected =
            this.state.mediaType === ReceiverSelectorMediaType.Screen;

        const isSelectedMediaTypeAvailable = !!(
            this.state.availableMediaTypes & this.state.mediaType
        );
        const isAppMediaTypeAvailable = !!(
            this.state.availableMediaTypes & ReceiverSelectorMediaType.App
        );


        return (
            <>
                <div className="media-select">
                    <div className="media-select__label-cast">
                        {_("popupMediaSelectCastLabel")}
                    </div>
                    <div className="select-wrapper">
                        <select
                            onChange={this.onSelectChange}
                            className="media-select__dropdown"
                            disabled={
                                this.state.availableMediaTypes ===
                                ReceiverSelectorMediaType.None
                            }
                        >
                            <option
                                value={ReceiverSelectorMediaType.App}
                                selected={isAppMediaTypeSelected}
                                disabled={!isAppMediaTypeAvailable}
                            >
                                {(this.state.appId &&
                                    knownApps[this.state.appId]?.name) ??
                                    _("popupMediaTypeApp")}
                            </option>

                            {this.state.mirroringEnabled && (
                                <>
                                    <option
                                        value={ReceiverSelectorMediaType.Tab}
                                        selected={isTabMediaTypeSelected}
                                        disabled={
                                            !(
                                                this.state.availableMediaTypes &
                                                ReceiverSelectorMediaType.Tab
                                            )
                                        }
                                    >
                                        {_("popupMediaTypeTab")}
                                    </option>
                                    <option
                                        value={ReceiverSelectorMediaType.Screen}
                                        selected={isScreenMediaTypeSelected}
                                        disabled={
                                            !(
                                                this.state.availableMediaTypes &
                                                ReceiverSelectorMediaType.Screen
                                            )
                                        }
                                    >
                                        {_("popupMediaTypeScreen")}
                                    </option>
                                </>
                            )}
                        </select>
                    </div>
                    <div className="media-select__label-to">
                        {_("popupMediaSelectToLabel")}
                    </div>
                </div>
                <ul className="receivers">
                    {this.state.receivers && this.state.receivers.length ? (
                        this.state.receivers.map((receiver, i) => (
                            <ReceiverEntry
                                receiver={receiver}
                                onCast={this.onCast}
                                onStop={this.onStop}
                                isLoading={this.state.isLoading}
                                canCast={isSelectedMediaTypeAvailable}
                                key={i}
                            />
                        ))
                    ) : (
                        <div className="receivers__not-found">
                            {_("popupNoReceiversFound")}
                        </div>
                    )}
                </ul>
            </>
        );
    }

    private onCast(receiver: ReceiverDevice) {
        this.setState({
            isLoading: true
        });

        this.port?.postMessage({
            subject: "receiverSelector:selected",
            data: {
                actionType: ReceiverSelectionActionType.Cast,
                receiver,
                mediaType: this.state.mediaType,
                filePath: this.state.filePath
            }
        });
    }

    private onStop(receiver: ReceiverDevice) {
        this.port?.postMessage({
            subject: "receiverSelector:stop",
            data: {
                actionType: ReceiverSelectionActionType.Stop,
                receiver
            }
        });
    }

    private onSelectChange(ev: React.ChangeEvent<HTMLSelectElement>) {
        const mediaType = parseInt(ev.target.value);

        if (mediaType === ReceiverSelectorMediaType.File) {
            const fileUrl = window.prompt();
            if (fileUrl) {
                this.setState({
                    mediaType,
                    filePath: fileUrl
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
    receiver: ReceiverDevice;
    isLoading: boolean;
    canCast: boolean;
    onCast(receiver: ReceiverDevice): void;
    onStop(receiver: ReceiverDevice): void;
}

interface ReceiverEntryState {
    ellipsis: string;
    isLoading: boolean;
    showAlternateAction: boolean;
}

class ReceiverEntry extends Component<ReceiverEntryProps, ReceiverEntryState> {
    constructor(props: ReceiverEntryProps) {
        super(props);

        this.state = {
            ellipsis: "",
            isLoading: false,
            showAlternateAction: false
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

    public render() {
        const { status } = this.props.receiver;
        const application = status?.applications?.[0];

        return (
            <li className="receiver">
                <div className="receiver__name">
                    {this.props.receiver.friendlyName}
                </div>
                <div className="receiver__address">
                    {application && !application.isIdleScreen
                        ? application.statusText
                        : `${this.props.receiver.host}:${this.props.receiver.port}`}
                </div>
                <button
                    className="button receiver__connect"
                    onClick={this.handleCast}
                    disabled={
                        this.state.showAlternateAction
                            ? !application || application.isIdleScreen
                            : this.props.isLoading || !this.props.canCast
                    }
                >
                    {this.state.isLoading
                        ? _(
                              "popupCastingButtonTitle",
                              this.state.isLoading ? this.state.ellipsis : ""
                          )
                        : this.state.showAlternateAction
                        ? _("popupStopButtonTitle")
                        : _("popupCastButtonTitle")}
                </button>
            </li>
        );
    }

    private handleCast() {
        const { status } = this.props.receiver;
        if (!status) {
            return;
        }

        const application = status.applications?.[0];

        if (this.state.showAlternateAction) {
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
    ReactDOM.render(<PopupApp />, document.querySelector("#root"));
});

window.addEventListener("contextmenu", () => {
    browser.menus.overrideContext({
        showDefaults: false
    });
});
