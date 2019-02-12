import React, { Component } from "react";
import { getNextEllipsis } from "../lib/utils";

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

        this.onGetDownloads = this.onGetDownloads.bind(this);
        this.onGetDownloadsResponse = this.onGetDownloadsResponse.bind(this);
        this.onGetDownloadsError = this.onGetDownloadsError.bind(this);

        this.state = {
            downloads: null
          , isLoadingDownloads: false
          , wasErrorLoadingDownloads: false
          , downloadsLoadingEllipsis: "..."
        };
    }


    onGetDownloads () {
        this.setState({
            isLoadingDownloads: true
        });

        const timeout = setInterval(() => {
            this.setState(state => ({
                downloadsLoadingEllipsis: getNextEllipsis(
                        state.downloadsLoadingEllipsis)
            }));
        }, 500);

        fetch(ENDPOINT_URL)
            .then(res => {
                window.clearTimeout(timeout);
                return res.json()
            })
            .then(this.onGetDownloadsResponse)
            .catch(this.onGetDownloadsError);
    }

    async onGetDownloadsResponse (res) {
        const platformInfo = await browser.runtime.getPlatformInfo();
        const downloads = res.assets
            .reduce((acc, asset) => {
                const download = {
                    name: asset.name
                  , url: asset.browser_download_url
                };

                const platformExtensions = {
                    "exe": "win"
                  , "pkg": "mac"
                  , "deb": "deb"
                  , "rpm": "rpm"
                };

                const fileExtension = asset.name.match(/.*\.(.*)$/).pop();

                if (fileExtension in platformExtensions) {
                    const platform = platformExtensions[fileExtension];
                    acc[platform] = download;
                }

                return acc;
            }, { platform: platformInfo.os });

        this.setState({
            isLoadingDownloads: false
          , downloads
        });
    }

    onGetDownloadsError (err) {
        this.setState({
            isLoadingDownloads: false
          , wasErrorLoadingDownloads: true
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
                    if (!this.props.loading
                            && (!this.props.info
                             || !this.props.info.isVersionCompatible)) {
                        <div className="bridge__download-info">
                            <h2 className="bridge__download-info-title">
                                { _("optionsBridgeDownloadsTitle") }
                            </h2>
                            { do {
                                if (this.state.downloads) {
                                    <BridgeDownloads info={ this.state.downloads }/>
                                } else if (this.state.wasErrorLoadingDownloads) {
                                    <div className="bridge__download-info-get-error">
                                        { _("optionsBridgeDownloadsGetFailed") }
                                    </div>
                                } else {
                                    <button className="bridge__download-info-get"
                                            onClick={ this.onGetDownloads }
                                            disabled={ this.state.isLoadingDownloads }>
                                        { do {
                                            if (this.state.isLoadingDownloads) {
                                                _("optionsBridgeDownloadsLoading"
                                                      , getNextEllipsis(this.state.downloadsLoadingEllipsis));
                                            } else {
                                                _("optionsBridgeDownloadsGet");
                                            }
                                        }}
                                    </button>
                                }
                            }}
                        </div>
                    }
                }}
            </div>
        );
    }
}
