import Popup from "./Popup.svelte";

// macOS styles
browser.runtime.getPlatformInfo().then(platformInfo => {
    if (platformInfo.os === "mac") {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "styles/mac.css";
        document.head.appendChild(link);
    }
});

const target = document.getElementById("root");
if (target) {
    const popup = new Popup({ target });
    window.addEventListener("unload", () => {
        popup.$destroy();
    });
}
