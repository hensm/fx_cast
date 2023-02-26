import MirroringPopup from "./MirroringPopup.svelte";

const target = document.getElementById("root");
if (target) {
    const mirroringPopup = new MirroringPopup({ target });
    window.addEventListener("beforeunload", () => {
        mirroringPopup.$destroy();
    });
}
