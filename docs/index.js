/* eslint-env browser */
"use strict";

// Set FAQ fragment IDs
for (const faq of document.querySelectorAll(".faq")) {
    const summary = faq.querySelector(".faq__summary");
    const formattedSummary = summary.textContent
        .replace(/\s\s+/g, " ")
        .trim()
        .replace(/ /g, "_");

    faq.id = formattedSummary;

    if (window.location.hash) {
        faq.open =
            decodeURIComponent(window.location.hash.slice(1)) ===
            formattedSummary;
    }
}

window.addEventListener("hashchange", () => {
    const targetElement = document.getElementById(
        decodeURI(window.location.hash.slice(1))
    );
    if (targetElement && targetElement instanceof HTMLDetailsElement) {
        targetElement.open = true;
    }
});

// Ext download button
const downloadExtBtn = document.querySelector(".download__ext");

const downloadsBridgeAll = document.querySelector(".download__bridge-all");
const downloadsBridgeList = document.querySelector(".download__bridge-list");
const downloadsBridgePrimary = document.querySelector(
    ".download__bridge-primary"
);

const downloadsBridgeWin = document.createElement("div");
const downloadsBridgeMac = document.createElement("div");
const downloadsBridgeLinux = document.createElement("div");

downloadsBridgeList.append(
    downloadsBridgeWin,
    downloadsBridgeMac,
    downloadsBridgeLinux
);

let platform;

switch (navigator.platform) {
    case "Win32":
    case "Win64":
        platform = "win";
        break;

    case "MacIntel":
        platform = "mac";
        break;
}

function addBridgeDownload(
    tag,
    version,
    url,
    title,
    bridgePlatform,
    linuxPackage
) {
    const downloadButton = document.createElement("a");
    downloadButton.classList.add("button", "button--puffy");
    downloadButton.href = url;
    downloadButton.title = title;
    downloadButton.dataset.platform = linuxPackage ?? bridgePlatform;

    const tagElement = document.createElement("span");
    tagElement.classList.add("app-tag");
    tagElement.textContent = tag;

    switch (bridgePlatform) {
        case "win":
            downloadButton.textContent = "Windows";
            downloadsBridgeWin.append(downloadButton);
            break;
        case "mac":
            downloadButton.textContent = "macOS";
            downloadsBridgeMac.append(downloadButton);
            break;
        case "linux":
            downloadButton.textContent = "Linux";
            downloadsBridgeLinux.append(downloadButton);
            break;
    }

    if (bridgePlatform === platform) {
        const primaryDownloadButton = downloadButton.cloneNode(true);
        primaryDownloadButton.textContent += " Bridge";
        primaryDownloadButton.append(tagElement.cloneNode(true));

        primaryDownloadButton.classList.add("download__app");
        downloadsBridgePrimary.append(primaryDownloadButton);
    }

    downloadButton.append(tagElement);
}

function populateDownloads(releaseList) {
    let extensionUrl;
    let extensionVersion;
    let extensionTitle;

    let bridgeVersion;
    const bridgeAssets = [];

    const PATTERN_FILE_EXT = /.*\.(.*)$/;
    const PATTERN_ARCH = /.*(x86|x64|arm64)\..*$/;

    for (const release of releaseList) {
        const releaseBridgeAssets = [];
        for (const asset of release.assets) {
            const fileExtension = asset.name.match(PATTERN_FILE_EXT).pop();
            if (fileExtension === "xpi") {
                if (extensionUrl) break;

                extensionUrl = asset.browser_download_url;
                extensionVersion = release.tag_name;
                extensionTitle = `${asset.name} (${formatSize(asset.size)})`;
            } else {
                switch (fileExtension) {
                    case "exe":
                    case "pkg":
                    case "deb":
                    case "rpm":
                        if (bridgeAssets.length) break;
                        releaseBridgeAssets.push(asset);
                }
            }
        }

        if (releaseBridgeAssets.length) {
            bridgeVersion = release.tag_name;
            bridgeAssets.push(...releaseBridgeAssets);
        }
    }

    downloadExtBtn.href = extensionUrl;
    downloadExtBtn.title = extensionTitle;
    downloadExtBtn.dataset.version = extensionVersion;
    downloadExtBtn.removeAttribute("disabled");

    for (const asset of bridgeAssets) {
        const fileExtension = asset.name.match(PATTERN_FILE_EXT).pop();
        const arch = asset.name.match(PATTERN_ARCH).pop();

        const assetTitle = `${asset.name} (${formatSize(asset.size)})`;

        let assetTag;
        let assetPlatform;

        switch (fileExtension) {
            case "exe":
                switch (arch) {
                    case "x64":
                        assetTag = "64-bit";
                        assetPlatform = "win";
                        break;
                    case "x86":
                        assetTag = "32-bit";
                        assetPlatform = "win";
                        break;
                }
                break;
            case "pkg":
                switch (arch) {
                    case "x64":
                        assetTag = "Intel";
                        assetPlatform = "mac";
                        break;
                    case "arm64":
                        assetTag = "ARM";
                        assetPlatform = "mac";
                        break;
                }
                break;
            case "deb":
                assetTag = "DEB";
                assetPlatform = "linux";
                break;
            case "rpm":
                assetTag = "RPM";
                assetPlatform = "linux";
                break;
        }

        addBridgeDownload(
            assetTag,
            bridgeVersion,
            asset.browser_download_url,
            assetTitle,
            assetPlatform,
            fileExtension === "deb" || fileExtension === "rpm"
                ? fileExtension
                : undefined
        );
    }

    if (!platform) {
        downloadsBridgeAll.open = true;
    }
}

(async () => {
    try {
        populateDownloads(
            await fetch(
                "https://api.github.com/repos/hensm/fx_cast/releases"
            ).then(res => res.json())
        );
    } catch (err) {
        console.error("Failed to fetch downloads!", err);
    }
})();

function formatSize(bytes, precision = 1, useMetric = false) {
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
            useMetric ? "KB" : "KiB"
        }`;
    } else if (bytes >= mxbyte && bytes < gxbyte) {
        return `${(bytes / mxbyte).toFixed(precision)} ${
            useMetric ? "MB" : "MiB"
        }`;
    } else if (bytes >= gxbyte && bytes < txbyte) {
        return `${(bytes / gxbyte).toFixed(precision)} ${
            useMetric ? "GB" : "GiB"
        }`;
    } else if (bytes >= txbyte && bytes < pxbyte) {
        return `${(bytes / txbyte).toFixed(precision)} ${
            useMetric ? "TB" : "TiB"
        }`;
    }
}
