<script lang="ts">
    import { afterUpdate, beforeUpdate, onMount } from "svelte";

    import Bridge from "./Bridge.svelte";
    import Whitelist from "./Whitelist.svelte";
    void Bridge, Whitelist;

    import logger from "../../lib/logger";

    import options, { Options } from "../../lib/options";
    import defaultOptions from "../../defaultOptions";

    const _ = browser.i18n.getMessage;

    let formElement: HTMLFormElement;
    let isFormValid = true;
    let showSavedIndicator = false;

    let opts: Options | undefined;
    onMount(async () => {
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

        try {
            if (!opts) return;

            // Remove unnecessary prop
            for (const item of opts.siteWhitelist) {
                if (item.isUserAgentDisabled === false) {
                    delete item.isUserAgentDisabled;
                }
            }

            await options.setAll(opts);

            // 1s long saved indicator
            showSavedIndicator = true;
            setTimeout(() => {
                showSavedIndicator = false;
            }, 1000);
        } catch (err) {
            logger.error("Failed to save options!");
        }
    }

    function onFormInput() {
        isFormValid = formElement.checkValidity();
    }

    function resetForm() {
        opts = JSON.parse(JSON.stringify(defaultOptions));
    }
</script>

{#if opts}
    <form
        id="form"
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
                        name="mediaEnabled"
                        id="mediaEnabled"
                        type="checkbox"
                        bind:checked={opts.mediaEnabled}
                    />
                </div>
                <label class="option__label" for="mediaEnabled">
                    {_("optionsMediaEnabled")}
                </label>
            </div>

            <div class="option option--inline">
                <div class="option__control">
                    <input
                        name="mediaSyncElement"
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

            <div class="option option--inline">
                <div class="option__control">
                    <input
                        name="mediaStopOnUnload"
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
                        name="localMediaEnabled"
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
                        name="localMediaServerPort"
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
                        name="mirroringEnabled"
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
                        name="mirroringAppId"
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
        </fieldset>

        <fieldset class="category">
            <legend class="category__name">
                <h2>{_("optionsReceiverSelectorCategoryName")}</h2>
            </legend>
            <p class="category__description">
                {_("optionsReceiverSelectorCategoryDescription")}
            </p>

            <div class="option option--inline">
                <div class="option__control">
                    <input
                        name="receiverSelectorWaitForConnection"
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
                    {_("optionsReceiverSelectorWaitForConnectionDescription")}
                </div>
            </div>

            <div class="option option--inline">
                <div class="option__control">
                    <input
                        name="receiverSelectorCloseIfFocusLost"
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
        </fieldset>

        <fieldset class="category">
            <legend class="category__name">
                <h2>{_("optionsSiteWhitelistCategoryName")}</h2>
            </legend>
            <p class="category__description">
                {_("optionsSiteWhitelistCategoryDescription")}
            </p>

            <div class="option option--inline">
                <div class="option__control">
                    <input
                        name="siteWhitelistEnabled"
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
                <div class="option__label">
                    {_("optionsSiteWhitelistContent")}
                </div>
                <div class="option__control">
                    <Whitelist bind:items={opts.siteWhitelist} />
                </div>
            </div>
        </fieldset>

        <div id="buttons">
            {#if showSavedIndicator}
                <div id="status-line">
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
    </form>
{/if}
