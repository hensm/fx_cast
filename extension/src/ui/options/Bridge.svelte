<script lang="ts">
    import semver from "semver";
    import { onMount } from "svelte";

    import LoadingIndicator from "../LoadingIndicator.svelte";

    import bridge, {
        BridgeInfo,
        BridgeTimedOutError,
        BridgeAuthenticationError
    } from "../../lib/bridge";
    import logger from "../../lib/logger";
    import type { Options } from "../../lib/options";

    import messaging from "../../messaging";

    const _ = browser.i18n.getMessage;

    export let opts: Options;

    let bridgeInfo: Nullable<BridgeInfo> = null;
    let bridgeInfoError: Nullable<Error> = null;
    let isLoadingInfo = true;

    // Status
    let statusIcon: string;
    let statusTitle: string;
    let statusText: Nullable<string> = null;

    async function updateBridgeStatus() {
        // Reset state
        bridgeInfo = null;
        bridgeInfoError = null;
        isLoadingInfo = true;
        statusText = null;

        try {
            bridgeInfo = await bridge.getInfo();
        } catch (err) {
            logger.error("Failed to fetch bridge/platform info.");
            if (err instanceof Error) {
                bridgeInfoError = err;
            }
        }

        isLoadingInfo = false;

        if (!bridgeInfo) {
            if (
                bridgeInfoError instanceof BridgeTimedOutError ||
                bridgeInfoError instanceof BridgeAuthenticationError
            ) {
                statusIcon = "assets/icons8-warn-120.png";
                statusTitle = _("optionsBridgeIssueStatusTitle");

                if (bridgeInfoError instanceof BridgeTimedOutError) {
                    statusText = _("optionsBridgeIssueStatusTextTimedOut");
                } else if (
                    bridgeInfoError instanceof BridgeAuthenticationError
                ) {
                    statusText = _(
                        "optionsBridgeIssueStatusTextAuthentication"
                    );
                }
            } else {
                statusIcon = "assets/icons8-cancel-120.png";
                statusTitle = _("optionsBridgeNotFoundStatusTitle");
                statusText = _("optionsBridgeNotFoundStatusText");
            }
        } else {
            if (bridgeInfo.isVersionCompatible) {
                statusIcon = "assets/icons8-ok-120.png";
                statusTitle = _("optionsBridgeFoundStatusTitle");
            } else {
                statusIcon = "assets/icons8-warn-120.png";
                statusTitle = _("optionsBridgeIssueStatusTitle");
            }
        }
    }

    onMount(() => {
        updateBridgeStatus();
    });

    // Updates
    let updateData: Nullable<UpdateManifestUpdate> = null;
    let updateStatus: Nullable<string> = null;
    let updateStatusTimeout: number;

    let isCheckingUpdate = false;
    let isUpdateAvailable = false;

    type UpdateManifestPlatform = "mac" | "win" | "linux-deb" | "linux-rpm";
    type UpdateManifestArch = "x86" | "x64" | "arm64";

    interface UpdateManifestUpdateInfo {
        update_link: string;
        update_hash: string;
    }
    interface UpdateManifestUpdate {
        version: string;
        platforms: Record<
            UpdateManifestPlatform,
            Partial<Record<UpdateManifestArch, UpdateManifestUpdateInfo>>
        >;
    }
    interface UpdateManifest {
        fx_cast_bridge: {
            updates: UpdateManifestUpdate[];
        };
    }

    async function fetchLatestUpdateInfo() {
        let updateManifest: UpdateManifest;
        try {
            updateManifest = await fetch(
                "https://hensm.github.io/fx_cast/updates.json"
            ).then(res => res.json());
        } catch (err) {
            throw new Error(
                "Failed to check for updates due to a network error!"
            );
        }

        const latestUpdate = updateManifest?.fx_cast_bridge?.updates?.reduce(
            (latest, next) =>
                semver.gt(next.version, latest.version) ? next : latest
        );
        if (!latestUpdate) {
            throw new Error(
                "Failed to check for updates due to invalid update manifest!"
            );
        }

        return latestUpdate;
    }

    async function checkUpdate() {
        isCheckingUpdate = true;

        try {
            const latestUpdate = await fetchLatestUpdateInfo();
            /**
             * Update available if no bridge found or bridge version lower
             * than fetched release version.
             */
            isUpdateAvailable =
                !bridgeInfo ||
                semver.lt(bridgeInfo.version, latestUpdate.version);

            if (isUpdateAvailable) {
                updateData = latestUpdate;
            } else {
                updateStatus = _("optionsBridgeUpdateStatusNoUpdates");
            }
        } catch (err) {
            if (err instanceof Error) logger.error(err.message);
            updateStatus = _("optionsBridgeUpdateStatusError");
            return;
        } finally {
            isCheckingUpdate = false;
            if (updateStatusTimeout) window.clearTimeout(updateStatusTimeout);
            updateStatusTimeout = window.setTimeout(() => {
                updateStatus = null;
            }, 1500);
        }
    }

    const getReleasePageUrl = (version: string) =>
        `https://github.com/hensm/fx_cast/releases/tag/${version}`;

    async function getUpdate() {
        if (!updateData) return;

        const platformArchMap: {
            [k in browser.runtime.PlatformArch]?: UpdateManifestArch;
        } = {
            "aarch64": "arm64",
            "x86-32": "x86",
            "x86-64": "x64"
        };

        let downloadUrl: Optional<string>;

        const platform = await browser.runtime.getPlatformInfo();
        const releasePlatformArch = platformArchMap[platform.arch];
        if (
            // We can't assume which Linux binary is required
            (platform.os === "mac" || platform.os === "win") &&
            releasePlatformArch &&
            platform.os in updateData.platforms
        ) {
            const releasePlatform = updateData.platforms[platform.os];
            const releaseInfo = releasePlatform[releasePlatformArch];
            downloadUrl = releaseInfo?.update_link;
        }

        if (downloadUrl) {
            // If there's a valid download URL, download that.
            browser.downloads.download({ url: downloadUrl });
        } else {
            // ...otherwise open a new tab for the update page.
            browser.tabs.create({
                url: getReleasePageUrl(updateData.version)
            });
        }
    }

    const [backupMessageStart, backupMessageEnd] = _(
        "optionsBridgeBackupEnabled",
        "\0"
    ).split("\0");
</script>

<div class="bridge">
    {#if isLoadingInfo}
        <div class="bridge__loading">
            {_("optionsBridgeLoading")}
            <progress />
        </div>
    {:else}
        <div
            class="bridge__info"
            class:bridge__info--found={!!bridgeInfo}
            class:bridge__info--error={!bridgeInfo}
        >
            <div class="bridge__status">
                <img
                    class="bridge__status-icon"
                    width="60"
                    height="60"
                    src={statusIcon}
                    alt="icon, bridge status"
                />
                <h2 class="bridge__status-title">{statusTitle}</h2>
                {#if statusText}
                    <p class="bridge__status-text">{statusText}</p>
                {/if}

                <button
                    type="button"
                    class="ghost bridge__refresh"
                    title={_("optionsBridgeRefresh")}
                    on:click={() => {
                        if (bridgeInfo && !bridgeInfoError) {
                            messaging.sendMessage({
                                subject: "main:refreshDeviceManager"
                            });
                        }
                        updateBridgeStatus();
                    }}
                />
            </div>

            {#if bridgeInfo}
                <table class="bridge__stats">
                    <tr>
                        <th>{_("optionsBridgeStatsName")}</th>
                        <td>{bridgeInfo.name}</td>
                    </tr>
                    <tr>
                        <th>{_("optionsBridgeStatsVersion")}</th>
                        <td>{bridgeInfo.version}</td>
                    </tr>
                    <tr>
                        <th>{_("optionsBridgeStatsExpectedVersion")}</th>
                        <td>{bridgeInfo.expectedVersion}</td>
                    </tr>
                    <tr>
                        <th>{_("optionsBridgeStatsCompatibility")}</th>
                        <td>
                            {bridgeInfo.isVersionCompatible
                                ? bridgeInfo.isVersionExact
                                    ? _("optionsBridgeCompatible")
                                    : _("optionsBridgeLikelyCompatible")
                                : _("optionsBridgeIncompatible")}
                        </td>
                    </tr>
                    <tr>
                        <th>{_("optionsBridgeStatsRecommendedAction")}</th>
                        <td>
                            {bridgeInfo.isVersionCompatible
                                ? _("optionsBridgeNoAction")
                                : bridgeInfo.isVersionOlder
                                ? _("optionsBridgeOlderAction")
                                : bridgeInfo.isVersionNewer
                                ? _("optionsBridgeNewerAction")
                                : _("optionsBridgeNoAction")}
                        </td>
                    </tr>
                </table>
            {/if}
        </div>
    {/if}

    <div class="bridge__options">
        <div class="option option--inline">
            <div class="option__control">
                <input
                    name="bridgeBackupEnabled"
                    id="bridgeBackupEnabled"
                    type="checkbox"
                    bind:checked={opts.bridgeBackupEnabled}
                />
            </div>
            <label class="option__label" for="bridgeBackupEnabled">
                {backupMessageStart}
                <input
                    class="bridge__backup-host"
                    name="bridgeBackupHost"
                    type="text"
                    required
                    bind:value={opts.bridgeBackupHost}
                />
                :
                <input
                    class="bridge__backup-port"
                    name="bridgeBackupPort"
                    type="number"
                    required
                    min="1025"
                    max="65535"
                    bind:value={opts.bridgeBackupPort}
                />
                {backupMessageEnd}
            </label>
            <div class="option__description">
                {_("optionsBridgeBackupEnabledDescription")}
            </div>
        </div>

        {#if opts.showAdvancedOptions}
            <fieldset
                class="bridge__daemon-options"
                disabled={!opts.bridgeBackupEnabled}
            >
                <div class="option option--inline">
                    <div class="option__control">
                        <input
                            id="bridgeBackupSecure"
                            type="checkbox"
                            bind:checked={opts.bridgeBackupSecure}
                        />
                    </div>
                    <label class="option__label" for="bridgeBackupSecure">
                        {_("optionsBridgeBackupSecure")}
                    </label>
                    <div class="option__description">
                        {_("optionsBridgeBackupSecureDescription")}
                    </div>
                </div>
                <div class="option">
                    <label class="option__label" for="bridgeBackupPassword">
                        {_("optionsBridgeBackupPassword")}
                    </label>
                    <div class="option__control">
                        <input
                            id="bridgeBackupPassword"
                            placeholder="Password"
                            type="password"
                            bind:value={opts.bridgeBackupPassword}
                        />
                        <div class="option__description">
                            {_("optionsBridgeBackupPasswordDescription")}
                        </div>
                    </div>
                </div>
            </fieldset>
        {/if}
    </div>

    {#if !isLoadingInfo}
        <div class="bridge__update-info">
            {#if isUpdateAvailable}
                <div class="bridge__update">
                    <p class="bridge__update-label">
                        {_("optionsBridgeUpdateAvailable")}
                    </p>
                    <div class="bridge__update-options">
                        <button
                            class="bridge__update-start"
                            type="button"
                            on:click={getUpdate}
                        >
                            {_("optionsBridgeUpdate")}
                        </button>
                        {#if updateData}
                            <a href={getReleasePageUrl(updateData.version)}>
                                {_("optionsBridgeUpdateViewChangelog")}
                            </a>
                        {/if}
                    </div>
                </div>
            {:else}
                <button
                    class="bridge__update-check"
                    type="button"
                    disabled={isCheckingUpdate}
                    on:click={checkUpdate}
                >
                    {#if isCheckingUpdate}
                        {_("optionsBridgeUpdateChecking", "")}<LoadingIndicator
                        />
                    {:else}
                        {_("optionsBridgeUpdateCheck")}
                    {/if}
                </button>
            {/if}

            {#if updateStatus && !isUpdateAvailable}
                <div class="bridge--update-status">
                    {updateStatus}
                </div>
            {/if}
        </div>
    {/if}
</div>
