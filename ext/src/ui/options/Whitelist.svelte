<script lang="ts">
    import { tick } from "svelte";

    import { WhitelistItemData } from "../../background/whitelist";
    import { REMOTE_MATCH_PATTERN_REGEX } from "../../lib/matchPattern";

    const _ = browser.i18n.getMessage;

    /** Whitelist items to display. */
    export let items: WhitelistItemData[];

    let isEditing = false;
    let isEditingValid = false;
    let editingIndex: number;
    let editingInput: HTMLInputElement;
    let editingValue: string;

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
        items = [...items, { pattern: "" }];
        beginEditing(items.length - 1);
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

            <li
                class="whitelist__item"
                class:whitelist__item--selected={isEditingItem}
                on:dblclick={() => beginEditing(i)}
            >
                <div class="whitelist__title">
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
                        {item.pattern}
                    {/if}
                </div>

                {#if !isEditingItem}
                    <label class="whitelist__user-agent">
                        <input
                            type="checkbox"
                            bind:checked={item.isUserAgentDisabled}
                        />
                        {_("optionsSiteWhitelistUserAgent")}
                    </label>
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
            </li>
        {/each}
    </ul>

    <hr />

    <div class="whitelist__view-actions">
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
