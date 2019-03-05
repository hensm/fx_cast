"use strict";

const ENDPOINT_URL = "https://api.github.com/repos/hensm/fx_cast/releases/latest";

fetch(ENDPOINT_URL)
    .then(res => res.json())
    .then(onResponse)
    .catch(onError);

function onResponse (res) {
    for (const asset of res.assets) {
        const { browser_download_url } = asset;

        // Ext download button
        const downloadExtBtn = document.querySelector(".download__ext");

        // App download buttons
        const appListMacBtn = document.querySelector(".app-list__mac");
        const appListDebBtn = document.querySelector(".app-list__deb");
        const appListRpmBtn = document.querySelector(".app-list__rpm");


        switch (asset.name.match(/.*\.(.*)$/).pop()) {
            case "xpi":
                downloadExtBtn.href = browser_download_url;
                downloadExtBtn.removeAttribute("disabled");
                downloadExtBtn.removeAttribute("title");
                break;

            case "exe":
                appListWinBtn.href = browser_download_url;
                appListWinBtn.removeAttribute("disabled");
                appListWinBtn.removeAttribute("title");
                break;
            case "pkg":
                appListMacBtn.href = browser_download_url;
                appListMacBtn.removeAttribute("disabled");
                appListMacBtn.removeAttribute("title");
                break;
            case "deb":
                appListDebBtn.href = browser_download_url;
                appListDebBtn.removeAttribute("disabled");
                appListDebBtn.removeAttribute("title");
                break;
            case "rpm":
                appListRpmBtn.href = browser_download_url;
                appListRpmBtn.removeAttribute("disabled");
                appListRpmBtn.removeAttribute("title");
                break;
        }
    }
}

function onError (err) {
    console.error("Failed to fetch download links");
}
