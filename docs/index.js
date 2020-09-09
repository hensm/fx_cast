"use strict";

// Set FAQ fragment IDs
for (const faq of document.querySelectorAll(".faq")) {
    const summary = faq.querySelector(".faq__summary");
    const formattedSummary = summary.textContent.trim().replace(/ /g, "_");

    faq.id = formattedSummary;

    if (window.location.hash) {
        faq.open = decodeURIComponent(
                window.location.hash.slice(1)) === formattedSummary;
    }
}


function updateThemeClass (mediaQuery) {
    if (mediaQuery.matches) {
        document.documentElement.classList.remove("theme-dark");
        document.documentElement.classList.add("theme-light");
    } else {
        document.documentElement.classList.remove("theme-light");
        document.documentElement.classList.add("theme-dark");
    }
}

const prefersLightScheme = window.matchMedia("(prefers-color-scheme: light)");

updateThemeClass(prefersLightScheme);
prefersLightScheme.addListener(updateThemeClass);


const downloadAppBtn = document.querySelector(".download__app");
const downloadAppOther = document.querySelector(".download__app-other");
const downloadAppOtherSummary = downloadAppOther.querySelector(":scope > summary");

// Ext download button
const downloadExtBtn = document.querySelector(".download__ext");

// App download buttons
const appList = document.querySelector(".app-list");
const appListWin64Btn = document.querySelector(".app-list__win64");
const appListWin32Btn = document.querySelector(".app-list__win32");
const appListMacBtn = document.querySelector(".app-list__mac");
const appListDebBtn = document.querySelector(".app-list__deb");
const appListRpmBtn = document.querySelector(".app-list__rpm");


let platform;

switch (navigator.platform) {
    case "Win32":
    case "Win64":
        platform = "win";
        downloadAppBtn.textContent = "Windows Bridge";
        appListWin64Btn.hidden = true;
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
        appListWin32Btn.classList.add("button", "button--puffy");
        appListWin64Btn.classList.add("button", "button--puffy");
        appListMacBtn.classList.add("button", "button--puffy");
        appListDebBtn.classList.add("button", "button--puffy");
        appListRpmBtn.classList.add("button", "button--puffy");
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

        const REGEX_EXT = /.*\.(.*)$/;
        const REGEX_ARCH = /.*(x(?:86|64))\..*$/;

        switch (asset.name.match(REGEX_EXT).pop()) {
            case "xpi":
                downloadExtBtn.href = asset.browser_download_url;
                downloadExtBtn.dataset.version = res.tag_name;
                downloadExtBtn.removeAttribute("disabled");
                downloadExtBtn.removeAttribute("title");
                break;


            case "exe":
                switch (asset.name.match(REGEX_ARCH).pop()) {
                    case "x86":
                        populateAppListApp(
                                appListWin32Btn, asset.browser_download_url
                              , asset.name, formattedSize);
                        break;
                    case "x64":
                        populateAppListApp(
                                appListWin64Btn, asset.browser_download_url
                              , asset.name, formattedSize);
                        break;
                }

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
                downloadAppBtn.href = appListWin64Btn.href;
                downloadAppBtn.title = appListWin64Btn.title;
                downloadAppBtn.dataset.version = res.tag_name;
                break;
            case "mac":
                downloadAppBtn.href = appListMacBtn.href;
                downloadAppBtn.title = appListMacBtn.title;
                downloadAppBtn.dataset.version = res.tag_name;
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


function formatSize (bytes, precision = 1, useMetric = false) {
    const factor = useMetric ? 1000 : 1024;

    // Sizes in bytes
    const kxbyte = factor;
    const mxbyte = kxbyte * factor;
    const gxbyte = mxbyte * factor;
    const txbyte = gxbyte * factor;
    const pxbyte = txbyte * factor;

    if (bytes >= 0 && bytes < kxbyte) {
        return `${bytes} B`;

    } else if (bytes >= kxbyte && bytes < mxbyte) {
        return `${(bytes / kxbyte).toFixed(precision)} ${
                useMetric ? "KB" : "KiB"}`;

    } else if (bytes >= mxbyte && bytes < gxbyte) {
        return `${(bytes / mxbyte).toFixed(precision)} ${
                useMetric ? "MB" : "MiB"}`;

    } else if (bytes >= gxbyte && bytes < txbyte) {
        return `${(bytes / gxbyte).toFixed(precision)} ${
                useMetric ? "GB" : "GiB"}`;

    } else if (bytes >= txbyte && bytes < pxbyte) {
        return `${(bytes / txbyte).toFixed(precision)} ${
                useMetric ? "TB" : "TiB"}`;

    } else if (bytes >= pxbyte) {
        return `${(bytes / pxbyte).toFixed(precision)} ${
                useMetric ? "PB" : "PiB"}`;
    }
}
