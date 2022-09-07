<script lang="ts">
    import { afterUpdate, onMount } from "svelte";

    import Bridge from "./Bridge.svelte";
    import Whitelist from "./Whitelist.svelte";
    void Bridge, Whitelist;

    import logger from "../../lib/logger";

    import options, { Options } from "../../lib/options";
    import defaultOptions from "../../defaultOptions";

    import { getChromeUserAgent } from "../../lib/userAgents";

    const _ = browser.i18n.getMessage;

    let formElement: HTMLFormElement;
    let isFormValid = true;
    let isSavedIndicatorVisible = false;

    let defaultUserAgent: Optional<string>;

    let opts: Options | undefined;
    onMount(async () => {
        const platform = (await browser.runtime.getPlatformInfo()).os;
        defaultUserAgent = getChromeUserAgent(platform);

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

        <fieldset class="category">
            <legend class="category__name">
                <h2>{_("optionsMediaCategoryName")}</h2>
            </legend>
            <p class="category__description">
                {_("optionsMediaCategoryDescription")}
            </p>

            <div class="option option--inline">
                <div class="option__control">
                    <input
                        id="mediaEnabled"
                        type="checkbox"
                        bind:checked={opts.mediaEnabled}
                    />
                </div>
                <label class="option__label" for="mediaEnabled">
                    {_("optionsMediaEnabled")}
                </label>
            </div>

            {#if opts.showAdvancedOptions}
                <div class="option option--inline">
                    <div class="option__control">
                        <input
                            id="mediaSyncElement"
                            type="checkbox"
                            bind:checked={opts.mediaSyncElement}
                        />
                    </div>
                    <label class="option__label" for="mediaSyncElement">
                        {_("optionsMediaSyncElement")}
                    </label>
                    <div class="option__description">
                        {_("optionsMediaSyncElementDescription")}
                    </div>
                </div>
            {/if}

            <div class="option option--inline">
                <div class="option__control">
                    <input
                        id="mediaStopOnUnload"
                        type="checkbox"
                        bind:checked={opts.mediaStopOnUnload}
                    />
                </div>
                <label class="option__label" for="mediaStopOnUnload">
                    {_("optionsMediaStopOnUnload")}
                </label>
            </div>

            <hr />

            <div class="option option--inline">
                <div class="option__control">
                    <input
                        id="localMediaEnabled"
                        type="checkbox"
                        bind:checked={opts.localMediaEnabled}
                    />
                </div>
                <label class="option__label" for="localMediaEnabled">
                    {_("optionsLocalMediaEnabled")}
                </label>
                <div class="option__description">
                    {_("optionsLocalMediaCategoryDescription")}
                </div>
            </div>

            <div class="option">
                <label class="option__label" for="localMediaServerPort">
                    {_("optionsLocalMediaServerPort")}
                </label>
                <div class="option__control">
                    <input
                        id="localMediaServerPort"
                        type="number"
                        required
                        min="1025"
                        max="65535"
                        bind:value={opts.localMediaServerPort}
                    />
                </div>
            </div>
        </fieldset>

        {#if opts.showAdvancedOptions}
            <fieldset class="category">
                <legend class="category__name">
                    <h2>{_("optionsMirroringCategoryName")}</h2>
                </legend>
                <p class="category__description">
                    {_("optionsMirroringCategoryDescription")}
                </p>

                <div class="option option--inline">
                    <div class="option__control">
                        <input
                            id="mirroringEnabled"
                            type="checkbox"
                            bind:checked={opts.mirroringEnabled}
                        />
                    </div>
                    <label class="option__label" for="mirroringEnabled">
                        {_("optionsMirroringEnabled")}
                    </label>
                </div>

                <div class="option">
                    <label class="option__label" for="mirroringAppId">
                        {_("optionsMirroringAppId")}
                    </label>
                    <div class="option__control">
                        <input
                            id="mirroringAppId"
                            type="text"
                            required
                            bind:value={opts.mirroringAppId}
                        />
                        <div class="option__description">
                            {_("optionsMirroringAppIdDescription")}
                        </div>
                    </div>
                </div>

                <details class="mirroring-stream">
                    <summary>
                        {_("optionsMirroringStreamOptions")}
                    </summary>

                    <div class="mirroring-stream__options">
                        <div class="option option--inline scaling-resolution">
                            <div class="option__control">
                                <input
                                    type="checkbox"
                                    name="scaling"
                                    id="mirroringStreamUseMaxResolution"
                                    bind:checked={opts.mirroringStreamUseMaxResolution}
                                />
                            </div>
                            <label
                                class="option__label"
                                for="mirroringStreamUseMaxResolution"
                            >
                                {_("optionsMirroringStreamMaxResolution")}
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
                                        .mirroringStreamMaxResolution.height}
                                />
                            </label>
                            <p class="option__description">
                                {_(
                                    "optionsMirroringStreamMaxResolutionDescription"
                                )}
                            </p>
                        </div>

                        <div class="option scaling-downscale">
                            <label
                                class="option__label"
                                for="mirroringStreamDownscaleFactor"
                            >
                                {_("optionsMirroringStreamDownscaleFactor")}
                            </label>
                            <div class="option__control">
                                <input
                                    id="mirroringStreamDownscaleFactor"
                                    type="number"
                                    required
                                    min="1"
                                    step="any"
                                    bind:value={opts.mirroringStreamDownscaleFactor}
                                />

                                <p class="option__description">
                                    {_(
                                        "optionsMirroringStreamDownscaleFactorDescription"
                                    )}
                                </p>
                            </div>
                        </div>

                        <div class="option">
                            <label
                                class="option__label"
                                for="mirroringStreamMaxFrameRate"
                            >
                                {_("optionsMirroringStreamFrameRate")}
                            </label>
                            <div class="option__control">
                                <input
                                    id="mirroringStreamMaxFrameRate"
                                    type="number"
                                    required
                                    min="1"
                                    bind:value={opts.mirroringStreamMaxFrameRate}
                                />
                            </div>
                        </div>

                        <div class="option">
                            <label
                                class="option__label"
                                for="mirroringStreamMaxBitRate"
                            >
                                {_("optionsMirroringStreamMaxBitRate")}
                            </label>
                            <div class="option__control">
                                <input
                                    id="mirroringStreamMaxBitRate"
                                    type="number"
                                    required
                                    min="1"
                                    bind:value={opts.mirroringStreamMaxBitRate}
                                />
                                <p class="option__description">
                                    {_(
                                        "optionsMirroringStreamMaxBitRateDescription"
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </details>
            </fieldset>
        {/if}

        {#if opts.showAdvancedOptions}
            <fieldset class="category">
                <legend class="category__name">
                    <h2>{_("optionsReceiverSelectorCategoryName")}</h2>
                </legend>
                <p class="category__description">
                    {_("optionsReceiverSelectorCategoryDescription")}
                </p>

                <!--
                <div class="option option--inline">
                    <div class="option__control">
                        <input
                            id="receiverSelectorWaitForConnection"
                            type="checkbox"
                            bind:checked={opts.receiverSelectorWaitForConnection}
                        />
                    </div>
                    <label
                        class="option__label"
                        for="receiverSelectorWaitForConnection"
                    >
                        {_("optionsReceiverSelectorWaitForConnection")}
                    </label>
                    <div class="option__description">
                        {_(
                            "optionsReceiverSelectorWaitForConnectionDescription"
                        )}
                    </div>
                </div>
                -->

                <div class="option option--inline">
                    <div class="option__control">
                        <input
                            id="receiverSelectorCloseIfFocusLost"
                            type="checkbox"
                            bind:checked={opts.receiverSelectorCloseIfFocusLost}
                        />
                    </div>
                    <label
                        class="option__label"
                        for="receiverSelectorCloseIfFocusLost"
                    >
                        {_("optionsReceiverSelectorCloseIfFocusLost")}
                    </label>
                </div>

                <div class="option option--inline">
                    <div class="option__control">
                        <input
                            id="receiverSelectorExpandActive"
                            type="checkbox"
                            bind:checked={opts.receiverSelectorExpandActive}
                        />
                    </div>
                    <label
                        class="option__label"
                        for="receiverSelectorExpandActive"
                    >
                        {_("optionsReceiverSelectorExpandActive")}
                    </label>
                </div>
            </fieldset>
        {/if}

        <fieldset class="category">
            <legend class="category__name">
                <h2>{_("optionsSiteWhitelistCategoryName")}</h2>
            </legend>
            <p class="category__description">
                {_("optionsSiteWhitelistCategoryDescription")}
            </p>

            {#if opts.showAdvancedOptions}
                <div class="option option--inline">
                    <div class="option__control">
                        <input
                            id="siteWhitelistEnabled"
                            type="checkbox"
                            bind:checked={opts.siteWhitelistEnabled}
                        />
                    </div>
                    <label class="option__label" for="siteWhitelistEnabled">
                        {_("optionsSiteWhitelistEnabled")}
                        <span class="option__recommended">
                            {_("optionsOptionRecommended")}
                        </span>
                    </label>
                    <div class="option__description">
                        {_("optionsSiteWhitelistEnabledDescription")}
                    </div>
                </div>

                <div class="option">
                    <label
                        class="option__label"
                        for="siteWhitelistCustomUserAgent"
                    >
                        {_("optionsSiteWhitelistCustomUserAgent")}
                    </label>
                    <div class="option__control">
                        <input
                            id="siteWhitelistCustomUserAgent"
                            type="text"
                            bind:value={opts.siteWhitelistCustomUserAgent}
                            placeholder={defaultUserAgent}
                        />
                        <div class="option__description">
                            {_(
                                "optionsSiteWhitelistCustomUserAgentDescription"
                            )}
                        </div>
                    </div>
                </div>
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
        </fieldset>

        <div class="form__footer">
            <div class="option option--inline">
                <div class="option__control">
                    <input
                        id="showAdvancedOptions"
                        type="checkbox"
                        bind:checked={opts.showAdvancedOptions}
                    />
                </div>
                <label class="option__label" for="showAdvancedOptions">
                    {_("optionsShowAdvancedOptions")}
                </label>
            </div>

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
