"use strict";

const downloadAppBtn = document.querySelector(".download__app");
const downloadAppOther = document.querySelector(".download__app-other");
const downloadAppOtherSummary = downloadAppOther.querySelector(":scope > summary");

// Ext download button
const downloadExtBtn = document.querySelector(".download__ext");

// App download buttons
const appList = document.querySelector(".app-list");
const appListWinBtn = document.querySelector(".app-list__win");
const appListMacBtn = document.querySelector(".app-list__mac");
const appListDebBtn = document.querySelector(".app-list__deb");
const appListRpmBtn = document.querySelector(".app-list__rpm");


let platform;

switch (navigator.platform) {
    case "Win32":
    case "Win64":
        platform = "win";
        downloadAppBtn.textContent = "Windows Bridge";
        appListWinBtn.hidden = true;
        break;

    case "MacIntel":
        platform = "mac";
        downloadAppBtn.textContent = "macOS Bridge";
        appListMacBtn.hidden = true;
        break;

    default:
        /**
         * Hide default download button and display other downloads
         * without details summary.
         */
        downloadAppBtn.remove();
        downloadAppOther.open = true;
        downloadAppOtherSummary.hidden = true;

        appList.classList.add("app-list--buttons");
        appListWinBtn.classList.add("btn", "btn--puffy");
        appListMacBtn.classList.add("btn", "btn--puffy");
        appListDebBtn.classList.add("btn", "btn--puffy");
        appListRpmBtn.classList.add("btn", "btn--puffy");
}


function populateAppListApp (element, fileUrl, fileName, fileSize) {
    element.href = fileUrl;
    element.title = `${fileName} (${fileSize})`;
    element.dataset.appSize = fileSize;
    element.removeAttribute("disabled");
}


const ENDPOINT_URL = "https://api.github.com/repos/hensm/fx_cast/releases/latest";

fetch(ENDPOINT_URL)
    .then(res => res.json())
    .then(onResponse)
    .catch(onError);

function onResponse (res) {
    for (const asset of res.assets) {
        const formattedSize = formatSize(asset.size);

        switch (asset.name.match(/.*\.(.*)$/).pop()) {
            case "xpi":
                downloadExtBtn.href = asset.browser_download_url;
                downloadExtBtn.removeAttribute("disabled");
                downloadExtBtn.removeAttribute("title");
                break;


            case "exe":
                populateAppListApp(
                        appListWinBtn, asset.browser_download_url
                      , asset.name, formattedSize);
                break;

            case "pkg":
                populateAppListApp(
                        appListMacBtn, asset.browser_download_url
                      , asset.name, formattedSize);
                break;

            case "deb":
                populateAppListApp(
                        appListDebBtn, asset.browser_download_url
                      , asset.name, formattedSize);
                break;

            case "rpm":
                populateAppListApp(
                        appListRpmBtn, asset.browser_download_url
                      , asset.name, formattedSize);
                break;
        }
    }

    if (platform) {
        switch (platform) {
            case "win":
                downloadAppBtn.href = appListWinBtn.href;
                downloadAppBtn.title = appListWinBtn.title;
                break;
            case "mac":
                downloadAppBtn.href = appListMacBtn.href;
                downloadAppBtn.title = appListMacBtn.title;
                break;

            default: {
                return;
            }
        }

        downloadAppBtn.removeAttribute("disabled");
    }
}

function onError (err) {
    console.error("Failed to fetch download links");
}


function formatSize (bytes, precision = 1) {
    // Sizes in bytes
    const kilobyte = 1024;
    const megabyte = kilobyte * 1024;
    const gigabyte = megabyte * 1024;
    const terabyte = gigabyte * 1024;
    const petabyte = terabyte * 1024;

    if (bytes >= 0 && bytes < kilobyte) {
        return `${bytes} B`;

    } else if (bytes >= kilobyte && bytes < megabyte) {
        return `${(bytes / kilobyte).toFixed(precision)} KB`;

    } else if (bytes >= megabyte && bytes < gigabyte) {
        return `${(bytes / megabyte).toFixed(precision)} MB`;

    } else if (bytes >= gigabyte && bytes < terabyte) {
        return `${(bytes / gigabyte).toFixed(precision)} GB`;

    } else if (bytes >= terabyte && bytes < petabyte) {
        return `${(bytes / terabyte).toFixed(precision)} TB`;

    } else if (bytes >= petabyte) {
        return `${(bytes / petabyte).toFixed(precision)} PB`;
    }
}
