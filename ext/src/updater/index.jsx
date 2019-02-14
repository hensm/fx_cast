"use strict";

import React, { Component } from "react";
import ReactDOM             from "react-dom";

import { getNextEllipsis } from "../lib/utils";

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


const Updater = (props) => (
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

class App extends Component {
    constructor (props) {
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

    async componentDidMount () {
        this.port = browser.runtime.connect({
            name: "updater"
        });

        this.port.onMessage.addListener(this.onMessage);
        browser.downloads.onChanged.addListener(this.onDownloadChanged);
    }

    componentDidUpdate () {
        // Size window to content
        browser.windows.update(this.win.id, {
            width: document.body.clientWidth + this.frameWidth
          , height: document.body.clientHeight + this.frameHeight
        });
    }

    closeWindow () {
        window.clearInterval(this.downloadProgressInterval);
        browser.downloads.onChanged.removeListener(this.onDownloadChanged);
        this.port.onMessage.removeListener(this.onMessage);
        this.port.disconnect();
    }

    async onMessage (message) {
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
            };
        }
    }

    onDownloadChanged (downloadItem) {
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
              , additionalDescription: _("updaterAdditionalDescriptionInstallReady")
            });
        }
    }

    async updateDownloadProgress () {
        const [ download ] = await browser.downloads.search({
            id: this.downloadId
        });

        this.setState({
            downloadTotal: download.totalBytes
          , downloadCurrent: download.bytesReceived
        });
    }

    async onCancel () {
        try {
            await browser.downloads.cancel(this.downloadId);
            this.closeWindow();
        } catch (err) {
            // Already cancelled or finished
        }
    }

    async onInstall () {
        try {
            await browser.downloads.open(this.downloadId);
            this.closeWindow();
        } catch (err) {
            // Cancelled or not finished
        }
    }

    render () {
        return do {
            if (this.state.hasLoaded) {
               <Updater description={ this.state.description }
                        additionalDescription={ this.state.additionalDescription }
                        downloadTotal={ this.state.downloadTotal }
                        downloadCurrent={ this.state.downloadCurrent }
                        isDownloading={ this.state.isDownloading }
                        onCancel={ this.onCancel }
                        onInstall={ this.onInstall } /> 
            }
        }
    }
}

ReactDOM.render(
    <App />
  , document.querySelector("#root"));
