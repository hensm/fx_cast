<script lang="ts">
    import { afterUpdate, onMount } from "svelte";

    import Bridge from "./Bridge.svelte";
    import Whitelist from "./Whitelist.svelte";
    void Bridge, Whitelist;

    import logger from "../../lib/logger";

    import options, { Options } from "../../lib/options";
    import defaultOptions from "../../defaultOptions";

    import { getChromeUserAgentString } from "../../lib/userAgents";
    import Option from "./Option.svelte";
    import OptionsCategory from "./OptionsCategory.svelte";

    const _ = browser.i18n.getMessage;

    let formElement: HTMLFormElement;
    let isFormValid = true;
    let isSavedIndicatorVisible = false;

    let defaultUserAgent: Optional<string>;

    let opts: Options | undefined;
    onMount(async () => {
        const platform = (await browser.runtime.getPlatformInfo()).os;
        defaultUserAgent = await getChromeUserAgentString(platform);

        opts = await options.getAll();
        options.addEventListener("changed", async () => {
            opts = await options.getAll();
        });
    });

    afterUpdate(() => {
        isFormValid = formElement?.checkValidity();
    });

    /** Saves options and show indicator. */
    async function onFormSubmit() {
        formElement.reportValidity();
        if (!opts) return;

        try {
            // Remove implicit whitelist item props
            for (const item of opts.siteWhitelist) {
                if (item.isUserAgentDisabled === false) {
                    delete item.isUserAgentDisabled;
                }
                if (item.customUserAgent === "") {
                    delete item.customUserAgent;
                }
            }

            await options.setAll(opts);

            // 1s long saved indicator
            isSavedIndicatorVisible = true;
            setTimeout(() => {
                isSavedIndicatorVisible = false;
            }, 1000);
        } catch (err) {
            logger.error("Failed to save options!");
        }
    }

    function onFormInput() {
        isFormValid = formElement.checkValidity();
    }

    function resetForm() {
        if (!opts) return;

        opts = {
            ...JSON.parse(JSON.stringify(defaultOptions)),
            // Retain advanced options shown state
            showAdvancedOptions: opts.showAdvancedOptions
        };
    }
</script>

{#if opts}
    <form
        class="form"
        bind:this={formElement}
        on:input={onFormInput}
        on:submit|preventDefault={onFormSubmit}
    >
        <Bridge bind:opts />

        <OptionsCategory
            name={_("optionsMediaCategoryName")}
            description={_("optionsMediaCategoryDescription")}
        >
            <Option
                id="mediaEnabled"
                label={_("optionsMediaEnabled")}
                type="checkbox"
                bind:checked={opts.mediaEnabled}
                inline
            />

            {#if opts.showAdvancedOptions}
                <Option
                    id="mediaSyncElement"
                    label={_("optionsMediaSyncElement")}
                    description={_("optionsMediaSyncElementDescription")}
                    type="checkbox"
                    bind:checked={opts.mediaSyncElement}
                    inline
                />
            {/if}

            <Option
                id="mediaStopOnUnload"
                label={_("optionsMediaStopOnUnload")}
                type="checkbox"
                bind:checked={opts.mediaStopOnUnload}
                inline
            />

            <hr />

            <Option
                id="localMediaEnabled"
                label={_("optionsLocalMediaEnabled")}
                description={_("optionsLocalMediaCategoryDescription")}
                type="checkbox"
                bind:checked={opts.localMediaEnabled}
                inline
            />

            <Option
                id="localMediaServerPort"
                label={_("optionsLocalMediaServerPort")}
                type="number"
                required
                min="1025"
                max="65535"
                bind:value={opts.localMediaServerPort}
            />
        </OptionsCategory>

        {#if opts.showAdvancedOptions}
            <OptionsCategory
                name={_("optionsMirroringCategoryName")}
                description={_("optionsMirroringCategoryDescription")}
            >
                <Option
                    id="mirroringEnabled"
                    label={_("optionsMirroringEnabled")}
                    type="checkbox"
                    bind:checked={opts.mirroringEnabled}
                    inline
                />

                <Option
                    id="mirroringAppId"
                    label={_("optionsMirroringAppId")}
                    description={_("optionsMirroringAppIdDescription")}
                    required
                    bind:value={opts.mirroringAppId}
                />

                <div class="mirroring-stream">
                    <details>
                        <summary>
                            {_("optionsMirroringStreamOptions")}
                        </summary>

                        <div class="mirroring-stream__options">
                            <Option
                                id="mirroringStreamUseMaxResolution"
                                label={_(
                                    "optionsMirroringStreamUseMaxResolution"
                                )}
                                description={_(
                                    "optionsMirroringStreamUseMaxResolutionDescription"
                                )}
                                class="scaling-resolution"
                                type="checkbox"
                                bind:checked={opts.mirroringStreamUseMaxResolution}
                                inline
                            >
                                <svelte:fragment slot="label">
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder={_(
                                            "optionsMirroringStreamMaxResolutionWidthPlaceholder"
                                        )}
                                        bind:value={opts
                                            .mirroringStreamMaxResolution.width}
                                    />
                                    ×
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder={_(
                                            "optionsMirroringStreamMaxResolutionHeightPlaceholder"
                                        )}
                                        bind:value={opts
                                            .mirroringStreamMaxResolution
                                            .height}
                                    />
                                </svelte:fragment>
                            </Option>

                            <Option
                                id="mirroringStreamDownscaleFactor"
                                label={_(
                                    "optionsMirroringStreamDownscaleFactor"
                                )}
                                description={_(
                                    "optionsMirroringStreamDownscaleFactorDescription"
                                )}
                                type="number"
                                required
                                min="1"
                                step="any"
                                bind:value={opts.mirroringStreamDownscaleFactor}
                                class="scaling-downscale"
                            />

                            <Option
                                id="mirroringStreamMaxFrameRate"
                                label={_("optionsMirroringStreamFrameRate")}
                                type="number"
                                required
                                min="1"
                                bind:value={opts.mirroringStreamMaxFrameRate}
                            />

                            <Option
                                id="mirroringStreamMaxBitRate"
                                label={_("optionsMirroringStreamMaxBitRate")}
                                description={_(
                                    "optionsMirroringStreamMaxBitRateDescription"
                                )}
                                type="number"
                                required
                                min="1"
                                bind:value={opts.mirroringStreamMaxBitRate}
                            />
                        </div>
                    </details>
                </div>
            </OptionsCategory>
        {/if}

        {#if opts.showAdvancedOptions}
            <OptionsCategory
                name={_("optionsReceiverSelectorCategoryName")}
                description={_("optionsReceiverSelectorCategoryDescription")}
            >
                <!-- <Option
                    id="receiverSelectorWaitForConnection"
                    label={_("optionsreceiverSelectorWaitForConnection")}
                    description={_("optionsReceiverSelectorWaitForConnectionDescription")}
                    type="checkbox"
                    bind:checked={opts.receiverSelectorWaitForConnection}
                /> -->

                <Option
                    id="receiverSelectorExpandActive"
                    label={_("optionsReceiverSelectorExpandActive")}
                    type="checkbox"
                    bind:checked={opts.receiverSelectorExpandActive}
                    inline
                />
                <Option
                    id="receiverSelectorShowMediaImages"
                    label={_("optionsreceiverSelectorShowMediaImages")}
                    description={_(
                        "optionsreceiverSelectorShowMediaImagesDescription"
                    )}
                    type="checkbox"
                    bind:checked={opts.receiverSelectorShowMediaImages}
                    inline
                />
                <Option
                    id="receiverSelectorCloseIfFocusLost"
                    label={_("optionsReceiverSelectorCloseIfFocusLost")}
                    type="checkbox"
                    bind:checked={opts.receiverSelectorCloseIfFocusLost}
                    inline
                />
            </OptionsCategory>
        {/if}

        <OptionsCategory
            name={_("optionsSiteWhitelistCategoryName")}
            description={_("optionsSiteWhitelistCategoryDescription")}
        >
            {#if opts.showAdvancedOptions}
                <Option
                    id="siteWhitelistEnabled"
                    label={_("optionsSiteWhitelistEnabled")}
                    description={_("optionsSiteWhitelistEnabledDescription")}
                    type="checkbox"
                    bind:checked={opts.siteWhitelistEnabled}
                    recommended
                    inline
                />

                <Option
                    id="siteWhitelistCustomUserAgent"
                    label={_("optionsSiteWhitelistCustomUserAgent")}
                    description={_(
                        "optionsSiteWhitelistCustomUserAgentDescription"
                    )}
                    bind:value={opts.siteWhitelistCustomUserAgent}
                    placeholder={defaultUserAgent}
                />
            {/if}

            <div class="option">
                <div class="option__label">
                    {_("optionsSiteWhitelistContent")}
                </div>
                <div class="option__control">
                    <Whitelist
                        bind:items={opts.siteWhitelist}
                        {opts}
                        {defaultUserAgent}
                    />
                </div>
            </div>
        </OptionsCategory>

        <div class="form__footer">
            <Option
                id="showAdvancedOptions"
                label={_("optionsShowAdvancedOptions")}
                type="checkbox"
                bind:checked={opts.showAdvancedOptions}
                inline
            />

            <div class="form__buttons">
                {#if isSavedIndicatorVisible}
                    <div class="form__status-line">
                        {_("optionsSaved")}
                    </div>
                {/if}

                <button on:click={resetForm} type="button">
                    {_("optionsReset")}
                </button>
                <button type="submit" default disabled={!isFormValid}>
                    {_("optionsSave")}
                </button>
            </div>
        </div>
    </form>
{/if}
