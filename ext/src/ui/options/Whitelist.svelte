<script lang="ts">
    import { tick } from "svelte";

    import knownApps, { KnownApp } from "../../cast/knownApps";
    import { WhitelistItemData } from "../../background/whitelist";
    import { REMOTE_MATCH_PATTERN_REGEX } from "../../lib/matchPattern";
    import { Options } from "../../lib/options";

    const _ = browser.i18n.getMessage;

    /** Whitelist items to display. */
    export let items: WhitelistItemData[];
    export let opts: Options;
    export let defaultUserAgent: Optional<string>;

    let isEditing = false;
    let isEditingValid = false;
    let editingIndex: number;
    let editingInput: HTMLInputElement;
    let editingValue: string;

    let expandedItemIndices = new Set();

    let knownAppToAdd: Nullable<KnownApp> = null;
    $: filteredKnownApps = Object.values(knownApps).filter(app => {
        // If no pattern or name matches default media sender
        if (!app.matches || app.name === _("popupMediaTypeAppMedia")) {
            return false;
        }
        // Filter if pattern already in whitelist
        return !items.find(item => item.pattern === app.matches);
    });

    async function beginEditing(index: number) {
        if (isEditing) return;

        editingIndex = index;
        editingValue = items[index].pattern;
        isEditing = true;

        await tick();

        isEditingValid = editingInput.validity.valid;
        editingInput.focus();
        editingInput.select();
    }
    function finishEditing() {
        if (!isEditing || !isEditingValid) return;

        isEditing = false;
        items[editingIndex].pattern = editingValue;
    }

    async function onEditKeydown(ev: KeyboardEvent) {
        key: switch (ev.key) {
            // Finish editing on enter
            case "Enter":
                finishEditing();
                break;

            // Cancel editing (or adding new item) on escape
            case "Escape": {
                const originalValue = items[editingIndex];
                switch (originalValue.pattern) {
                    case "":
                        removeItem(editingIndex);
                        break key;
                    case editingValue:
                        finishEditing();
                        break key;
                }

                editingValue = originalValue.pattern;
                await tick();
                isEditingValid = editingInput.validity.valid;
                editingInput.select();

                break;
            }
        }
    }

    function onEditInput() {
        editingInput.setCustomValidity(
            // Has duplicate pattern
            items.some(
                (item, index) =>
                    index !== editingIndex && item.pattern === editingValue
            )
                ? _("optionsSiteWhitelistInvalidDuplicatePattern")
                : ""
        );

        isEditingValid = editingInput.validity.valid;
    }

    function addItem() {
        if (isEditing) return;

        if (knownAppToAdd?.matches) {
            items = [...items, { pattern: knownAppToAdd.matches }];
            knownAppToAdd = null;
        } else {
            items = [...items, { pattern: "" }];
            beginEditing(items.length - 1);
        }
    }
    function removeItem(index: number) {
        if (isEditing) {
            if (index !== editingIndex) return;
            isEditing = false;
        }

        items.splice(index, 1);
        items = items;
    }
</script>

<div class="whitelist">
    <ul class="whitelist__items">
        {#each items as item, i}
            {@const isEditingItem = isEditing && editingIndex === i}
            {@const isItemExpanded = expandedItemIndices.has(i)}

            <li
                class="whitelist__item"
                class:whitelist__item--selected={isEditingItem}
                class:whitelist__item--expanded={isItemExpanded}
            >
                <div
                    class="whitelist__title"
                    on:dblclick={() => beginEditing(i)}
                >
                    {#if isEditingItem}
                        <input
                            type="text"
                            class="whitelist__input-pattern"
                            pattern={REMOTE_MATCH_PATTERN_REGEX.source}
                            required
                            bind:this={editingInput}
                            bind:value={editingValue}
                            on:input={onEditInput}
                            on:keydown={onEditKeydown}
                            on:blur={finishEditing}
                        />
                    {:else}
                        {@const knownApp = Object.values(knownApps).find(
                            app => app.matches === item.pattern
                        )}
                        <div class="whitelist__pattern">
                            {item.pattern}
                        </div>
                        {#if knownApp}
                            <div class="whitelist__known-app">
                                &nbsp;({knownApp.name})
                            </div>
                        {/if}
                    {/if}
                </div>

                {#if !isEditingItem}
                    <button
                        type="button"
                        class="whitelist__edit-button ghost"
                        title={_("optionsSiteWhitelistEditItem")}
                        disabled={isEditing && !isEditingValid}
                        on:click={() => beginEditing(i)}
                    >
                        <img src="assets/photon_edit.svg" alt="icon, edit" />
                    </button>
                {/if}

                <button
                    type="button"
                    class="whitelist__remove-button ghost"
                    title={_("optionsSiteWhitelistRemoveItem")}
                    disabled={isEditing && !isEditingItem && !isEditingValid}
                    on:click={() => removeItem(i)}
                >
                    <img src="assets/photon_delete.svg" alt="icon, remove" />
                </button>

                {#if !isEditingItem}
                    <button
                        type="button"
                        class="whitelist__expand-button ghost"
                        title={_("optionsSiteWhitelistExpandItem")}
                        on:click={() => {
                            // Toggle expanded state
                            if (isItemExpanded) {
                                expandedItemIndices.delete(i);
                            } else {
                                expandedItemIndices.add(i);
                            }
                            expandedItemIndices = expandedItemIndices;
                        }}
                    >
                        <img
                            src="assets/{isItemExpanded
                                ? 'photon_arrowhead_up.svg'
                                : 'photon_arrowhead_down.svg'}"
                            alt="icon, arrow down"
                        />
                    </button>

                    {#if isItemExpanded}
                        <div class="whitelist__expanded">
                            <div class="option option--inline">
                                <div class="option__control">
                                    <input
                                        id="isUserAgentDisabled-{i}"
                                        type="checkbox"
                                        bind:checked={item.isUserAgentDisabled}
                                    />
                                </div>
                                <label
                                    class="option__label"
                                    for="isUserAgentDisabled-{i}"
                                >
                                    {_("optionsSiteWhitelistUserAgentDisabled")}
                                </label>
                                <div class="option__description">
                                    {_(
                                        "optionsSiteWhitelistUserAgentDisabledDescription"
                                    )}
                                </div>
                            </div>

                            <div class="option">
                                <label
                                    class="option__label"
                                    for="customUserAgentString-{i}"
                                >
                                    {_(
                                        "optionsSiteWhitelistSiteSpecificUserAgent"
                                    )}
                                </label>
                                <div class="option__control">
                                    <input
                                        id="customUserAgentString-{i}"
                                        type="text"
                                        bind:value={item.customUserAgent}
                                        placeholder={opts.siteWhitelistCustomUserAgent ||
                                            defaultUserAgent}
                                    />
                                    <div class="option__description">
                                        {_(
                                            "optionsSiteWhitelistSiteSpecificUserAgentDescription"
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}
                {/if}
            </li>
        {/each}
    </ul>

    <hr />

    <div class="whitelist__view-actions">
        <div class="select-wrapper">
            <select bind:value={knownAppToAdd}>
                <option value={null}>
                    {_("optionsSiteWhitelistKnownAppsCustomApp")}
                </option>
                {#each filteredKnownApps as knownApp}
                    <option value={knownApp}>
                        {knownApp.name}
                    </option>
                {/each}
            </select>
        </div>
        <button
            class="whitelist__add-button ghost"
            title={_("optionsSiteWhitelistAddItem")}
            on:click={addItem}
            type="button"
        >
            <img src="assets/photon_new.svg" alt="icon, add" />
        </button>
    </div>
</div>
