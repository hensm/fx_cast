<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import MirroringSender from "../../cast/senders/mirroring";
    import logger from "../../lib/logger";

    import options, { Options } from "../../lib/options";
    import messaging, { Port } from "../../messaging";

    import type { ReceiverDevice } from "../../types";
    import LoadingIndicator from "../LoadingIndicator.svelte";

    const _ = browser.i18n.getMessage;

    document.title = _("mirroringPopupTitle");

    let port: Optional<Port>;
    let opts: Optional<Options>;

    let device: ReceiverDevice;

    let mirroringSender: Optional<MirroringSender>;
    let isSessionCreated = false;
    let isMirroringConnected = false;

    onMount(async () => {
        port = messaging.connect({ name: "mirroring" });
        port.onMessage.addListener(message => {
            switch (message.subject) {
                case "mirroringPopup:init":
                    device = message.data.device;

                    mirroringSender = new MirroringSender({
                        receiverDevice: device,
                        onSessionCreated() {
                            isSessionCreated = true;
                        },
                        onMirroringConnected() {
                            isMirroringConnected = true;
                        },
                        onMirroringStopped() {
                            window.close();
                        }
                    });

                    break;
            }
        });

        opts = await options.getAll();
    });

    onDestroy(() => {
        mirroringSender?.stop();
        port?.disconnect();
    });

    async function requestDisplayMedia() {
        if (!mirroringSender) return;

        try {
            mirroringSender.createMirroringConnection(
                await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: "motion",
                        frameRate: opts?.mirroringStreamMaxFrameRate
                    },
                    // Currently not implemented in Firefox
                    audio: true
                })
            );
        } catch (err) {
            logger.error("Failed to create mirroring connection!", err);
        }
    }
</script>

{#if isSessionCreated}
    <div class="mirroring-status">
        {#if isMirroringConnected}
            <p>
                {_("mirroringPopupMirroringTo", device.friendlyName)}
            </p>
            <button on:click={() => window.close()}>
                {_("mirroringPopupStopMirroring")}
            </button>
        {:else}
            <p>
                {_("mirroringPopupConnectedTo", device.friendlyName)}
            </p>
            <button on:click={requestDisplayMedia} class="button">
                {_("mirroringPopupChooseSource")}
            </button>
        {/if}
    </div>
{:else}
    <p>
        <LoadingIndicator
            >{_("mirroringPopupWaitingForConnection")}</LoadingIndicator
        >
    </p>
{/if}
