"use strict";

import React, { Component } from "react";
import ReactDOM from "react-dom";

import { getNextEllipsis } from "../lib/utils";
import { DownloadDelta, Message } from "../types";

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


interface UpdaterProps {
    description: string;
    additionalDescription: string;
    downloadTotal: number;
    downloadCurrent: number;
    isDownloading: boolean;
    onCancel (): void;
    onInstall (): void;
}

const Updater = (props: UpdaterProps) => (
    <div className="updater">
        <div className="updater__description">
            { props.description }
        </div>
        <div className="updater__additional-description">
            { props.additionalDescription }
        </div>
        <progress className="updater__progress"
                  max={ props.downloadTotal }
                  value={ props.downloadCurrent }>
        </progress>
        <button className="updater__install"
                onClick={ props.onInstall }
                disabled={ props.isDownloading }>
            { _("updaterInstall") }
        </button>
        <button className="updater__cancel"
                onClick={ props.onCancel }
                disabled={ !props.isDownloading }>
            { _("updaterCancel") }
        </button>
    </div>
);


interface UpdaterAppState {
    hasLoaded: boolean;
    isDownloading: boolean;
    description: string;
    additionalDescription: string;
    downloadTotal: number;
    downloadCurrent: number;
}

class UpdaterApp extends Component<{}, UpdaterAppState> {
    private downloadId: number;
    private downloadProgressInterval: number;
    private port: browser.runtime.Port;
    private frameWidth: number;
    private frameHeight: number;
    private win: browser.windows.Window;

    constructor (props: {}) {
        super(props);

        this.downloadId = null;
        this.downloadProgressInterval = null;

        this.onMessage = this.onMessage.bind(this);
        this.onDownloadChanged = this.onDownloadChanged.bind(this);
        this.updateDownloadProgress = this.updateDownloadProgress.bind(this);
        this.onCancel = this.onCancel.bind(this);
        this.onInstall = this.onInstall.bind(this);

        this.state = {
            hasLoaded: false
          , isDownloading: true
          , description: _("updaterDescriptionDownloading")
          , additionalDescription: _("updaterAdditionalDescriptionDownloading")
          , downloadTotal: 0
          , downloadCurrent: 0
        };
    }

    public async componentDidMount () {
        this.port = browser.runtime.connect({
            name: "updater"
        });

        this.port.onMessage.addListener(this.onMessage);
        browser.downloads.onChanged.addListener(this.onDownloadChanged);
    }

    public componentDidUpdate () {
        // Size window to content
        browser.windows.update(this.win.id, {
            width: document.body.clientWidth + this.frameWidth
          , height: document.body.clientHeight + this.frameHeight
        });
    }

    public render () {
        if (!this.state.hasLoaded) {
            return;
        }

        return (
            <Updater description={ this.state.description }
                     additionalDescription={ this.state.additionalDescription }
                     downloadTotal={ this.state.downloadTotal }
                     downloadCurrent={ this.state.downloadCurrent }
                     isDownloading={ this.state.isDownloading }
                     onCancel={ this.onCancel }
                     onInstall={ this.onInstall } />
        );
    }

    private async onMessage (message: Message) {
        switch (message.subject) {
            case "updater:/updateData": {
                // Only run once
                if (this.downloadId) {
                    return;
                }

                this.win = await browser.windows.getCurrent();
                this.frameWidth = this.win.width - window.innerWidth;
                this.frameHeight = this.win.height - window.innerHeight;

                // Cleanup
                if (this.downloadId) {
                    browser.downloads.cancel(this.downloadId);
                }
                if (this.downloadProgressInterval) {
                    window.clearInterval(this.downloadProgressInterval);
                }

                this.downloadId = await browser.downloads.download({
                    url: message.data.browser_download_url
                  , filename: message.data.name
                });

                this.updateDownloadProgress();

                this.downloadProgressInterval = window.setInterval(
                        this.updateDownloadProgress, 500);

                this.setState({
                    hasLoaded: true
                  , isDownloading: true
                });

                break;
            }
        }
    }

    private closeWindow () {
        window.clearInterval(this.downloadProgressInterval);
        browser.downloads.onChanged.removeListener(this.onDownloadChanged);
        this.port.onMessage.removeListener(this.onMessage);
        this.port.disconnect();
    }

    private onDownloadChanged (downloadItem: DownloadDelta) {
        if (downloadItem.id !== this.downloadId) {
            return;
        }

        if (downloadItem.canResume) {
            // Paused
            if (downloadItem.canResume.current) {
                window.clearInterval(this.downloadProgressInterval);
                this.setState({
                    isDownloading: false
                });

            // Cancelled
            } else {
                window.clearInterval(this.downloadProgressInterval);
                this.setState({
                    isDownloading: false
                });
            }

        // Download finished
        } else if (downloadItem.state
                && downloadItem.state.current === "complete") {

            window.clearInterval(this.downloadProgressInterval);
            this.setState({
                isDownloading: false
              , downloadTotal: 1
              , downloadCurrent: 1
              , description: _("updaterDescriptionInstallReady")
              , additionalDescription:
                      _("updaterAdditionalDescriptionInstallReady")
            });
        }
    }

    private async updateDownloadProgress () {
        const [ download ] = await browser.downloads.search({
            id: this.downloadId
        });

        this.setState({
            downloadTotal: download.totalBytes
          , downloadCurrent: download.bytesReceived
        });
    }

    private async onCancel () {
        try {
            await browser.downloads.cancel(this.downloadId);
            this.closeWindow();
        } catch (err) {
            // Already cancelled or finished
        }
    }

    private async onInstall () {
        try {
            await browser.downloads.open(this.downloadId);
            this.closeWindow();
        } catch (err) {
            // Cancelled or not finished
        }
    }
}

ReactDOM.render(
    <UpdaterApp />
  , document.querySelector("#root"));
