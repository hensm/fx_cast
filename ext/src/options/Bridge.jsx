import React, { Component } from "react";
import semver from "semver";

import { getNextEllipsis
       , getWindowCenteredProps } from "../lib/utils";

const _ = browser.i18n.getMessage;

const ENDPOINT_URL = "https://api.github.com/repos/hensm/fx_cast/releases/14720978";


async function downloadApp (info, platform) {
    const download = browser.downloads.download({
        filename: info[platform].name
      , url: info[platform].url
    });
}

const BridgeDownloads = (props) => (
    <div className="bridge-downloads">
        <button className="bridge-downloads__download
                           bridge-downloads__win"
                disabled
                onClick={ () => downloadApp(props.info, "win") }>
            Windows
        </button>
        <button className="bridge-downloads__download
                           bridge-downloads__mac"
                onClick={ () => downloadApp(props.info, "mac") }>
            macOS
        </button>

        <div className="bridge-downloads__linux">
            <button className="bridge-downloads__download"
                    onClick={ () => downloadApp(props.info, "deb") }>
                Linux (deb)
            </button>
            <button className="bridge-downloads__download"
                    onClick={ () => downloadApp(props.info, "rpm") }>
                Linux (rpm)
            </button>
        </div>
    </div>
);

const BridgeStats = (props) => (
    <table className="bridge__stats">
        <tr>
            <th>{ _("optionsBridgeStatsName") }</th>
            <td>{ props.info.name }</td>
        </tr>
        <tr>
            <th>{ _("optionsBridgeStatsVersion") }</th>
            <td>{ props.info.version }</td>
        </tr>
        <tr>
            <th>{ _("optionsBridgeStatsExpectedVersion") }</th>
            <td>{ props.info.expectedVersion }</td>
        </tr>
        <tr>
            <th>{ _("optionsBridgeStatsCompatibility") }</th>
            <td>
                { do {
                    if (props.info.isVersionCompatible) {
                        if (props.info.isVersionExact) {
                            _("optionsBridgeCompatible")
                        } else {
                            _("optionsBridgeLikelyCompatible")
                        }
                    } else {
                        _("optionsBridgeIncompatible")
                    }
                }}
            </td>
        </tr>
        <tr>
            <th>{ _("optionsBridgeStatsRecommendedAction") }</th>
            <td>
                { do {
                    if (props.info.isVersionOlder) {
                        _("optionsBridgeOlderAction")
                    } else if (props.info.isVersionNewer) {
                        _("optionsBridgeNewerAction")
                    } else {
                        _("optionsBridgeNoAction")
                    }
                }}
            </td>
        </tr>
    </table>
);

export default class Bridge extends Component {
    constructor (props) {
        super(props);

        this.onCheckUpdates = this.onCheckUpdates.bind(this);
        this.onCheckUpdatesResponse = this.onCheckUpdatesResponse.bind(this);
        this.onCheckUpdatesError = this.onCheckUpdatesError.bind(this);
        this.onUpdate = this.onUpdate.bind(this);
        this.onPackageTypeChange = this.onPackageTypeChange.bind(this);

        this.updateData = null;
        this.updateStatusTimeout = null;

        this.state = {
            isCheckingUpdates: false
          , isUpdateAvailable: false
          , wasErrorCheckingUpdates: false
          , checkUpdatesEllipsis: "..."
          , updateStatus: null
          , packageType: null
        };
    }


    onCheckUpdates () {
        this.setState({
            isCheckingUpdates: true
        });

        const timeout = setInterval(() => {
            this.setState(state => ({
                checkUpdatesEllipsis: getNextEllipsis(
                        state.checkUpdatesEllipsis)
            }));
        }, 500);

        fetch(ENDPOINT_URL)
            .then(res => {
                window.clearTimeout(timeout);
                return res.json()
            })
            .then(this.onCheckUpdatesResponse)
            .catch(this.onCheckUpdatesError);
    }

    showUpdateStatus () {
        if (this.updateStatusTimeout) {
            window.clearTimeout(this.updateStatusTimeout);
        }
        this.updateStatusTimeout = window.setTimeout(() => {
            this.setState({
                updateStatus: null
            });
        }, 1500);
    }

    async onUpdate () {
        // Current window to base centered position on
        const win = await browser.windows.getCurrent();
        const centeredProps = getWindowCenteredProps(win, 400, 150);

        const updaterPopup = await browser.windows.create({
            url: "../updater/index.html"
          , type: "popup"
          , ...centeredProps
        });

        // Size/position not set correctly on creation (bug?)
        await browser.windows.update(updaterPopup.id, {
            ...centeredProps
        });

        browser.runtime.onConnect.addListener(port => {
            if (port.name === "updater") {
                const asset = this.updateData.assets.find(asset => {
                    const fileExtension = asset.name.match(/.*\.(.*)$/).pop();
                    const currentPlatform = (this.props.platform === "linux")
                        ? this.state.packageType
                        : this.props.platform;

                    switch (fileExtension) {
                        case "exe": return "win" === currentPlatform;
                        case "pkg": return "mac" === currentPlatform;
                        case "deb": return "deb" === currentPlatform;
                        case "rpm": return "rpm" === currentPlatform;
                    }
                });

                port.postMessage({
                    subject: "updater:/updateData"
                  , data: asset
                });

                port.onDisconnect.addListener(() => {
                    browser.windows.remove(updaterPopup.id);
                });
            }
        });
    }


    async onCheckUpdatesResponse (res) {
        const isUpdateAvailable = !this.props.info || semver.lt(
                this.props.info.version, res.tag_name);

        if (isUpdateAvailable) {
            this.updateData = res;
        }

        this.setState({
            isCheckingUpdates: false
          , isUpdateAvailable
          , updateStatus: !isUpdateAvailable
                ? _("optionsBridgeUpdateStatusNoUpdates")
                : null
        });

        this.showUpdateStatus();
    }

    onCheckUpdatesError (err) {
        this.setState({
            isCheckingUpdates: false
          , wasErrorCheckingUpdates: true
          , updateStatus: _("optionsBridgeUpdateStatusError")
        });

        this.showUpdateStatus();
    }

    onPackageTypeChange (ev) {
        this.setState({
            packageType: ev.target.value
        });
    }


    render () {
        return (
            <div className="bridge">
                { do {
                    if (this.props.loading) {
                        <div className="bridge__loading">
                            { _("optionsBridgeLoading") }
                            <progress></progress>
                        </div>
                    } else {
                        const infoClasses = `bridge__info ${this.props.info
                            ? "bridge__info--found"
                            : "bridge__info--not-found"}`;

                        const [ statusIcon, statusTitle, statusText ] = do {
                            if (!this.props.info) {
                                [ "assets/icons8-cancel-120.png"
                                  , _("optionsBridgeNotFoundStatusTitle")
                                  , _("optionsBridgeNotFoundStatusText") ]
                            } else {
                                if (this.props.info.isVersionCompatible) {
                                    [ "assets/icons8-ok-120.png"
                                      , _("optionsBridgeFoundStatusTitle") ]
                                } else {
                                    [ "assets/icons8-warn-120.png"
                                      , _("optionsBridgeIssueStatusTitle") ]
                                }
                            }
                        };

                        <div className={infoClasses}>
                            <div className="bridge__status">
                                <img className="bridge__status-icon"
                                     width="60" height="60"
                                     src={ statusIcon } />

                                <h2 className="bridge__status-title">
                                    { statusTitle }
                                </h2>

                                { do {
                                    if (statusText) {
                                        <p className="bridge__status-text">
                                            { statusText }
                                        </p>
                                    }
                                }}
                            </div>

                            { do {
                                if (this.props.info) {
                                    <BridgeStats info={ this.props.info }/>
                                }
                            }}
                        </div>
                    }
                }}

                { do {
                    if (!this.props.loading) {
                        <div className="bridge__update-info">
                            { do {
                                if (this.state.isUpdateAvailable) {
                                    <div className="bridge__update">
                                        <p className="bridge__update-label">
                                            { _("optionsBridgeUpdateAvailable") }
                                        </p>
                                        <div className="bridge__update-options">
                                            { do {
                                                if (this.props.platform === "linux") {
                                                    <select className="bridge__update-package-type"
                                                            onChange={ this.onPackageTypeChange }
                                                            value={ this.state.packageType }>
                                                        <option value="" disabled selected>
                                                            { _("optionsBridgeUpdatePackageTypeSelect") }
                                                        </option>
                                                        <option value="deb">
                                                            { _("optionsBridgeUpdatePackageTypeDeb") }
                                                        </option>
                                                        <option value="rpm">
                                                            { _("optionsBridgeUpdatePackageTypeRpm") }
                                                        </option>
                                                    </select>
                                                }
                                            }}
                                            <button className="bridge__update-start"
                                                    onClick={ this.onUpdate }
                                                    disabled={ this.props.platform === "linux"
                                                            && !this.state.packageType }>
                                                { _("optionsBridgeUpdate") }
                                            </button>
                                        </div>
                                    </div>
                                } else {
                                    <button className="bridge__update-check"
                                            disabled={ this.state.isCheckingUpdates }
                                            onClick={ this.onCheckUpdates }>

                                        { do {
                                            if (this.state.isCheckingUpdates) {
                                                _("optionsBridgeUpdateChecking"
                                                      , getNextEllipsis(this.state.checkUpdatesEllipsis));
                                            } else {
                                                _("optionsBridgeUpdateCheck");
                                            }
                                        }}
                                    </button>
                                }
                            }}

                            <div className="bridge--update-status">
                                { do {
                                    if (this.state.updateStatus
                                            && !this.state.isUpdateAvailable) {
                                        this.state.updateStatus;
                                    }
                                }}
                            </div>
                        </div>
                    }
                }}
            </div>
        );
    }
}
