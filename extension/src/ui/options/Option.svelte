<script lang="ts">
    import type { HTMLInputAttributes } from "svelte/elements";

    const _ = browser.i18n.getMessage;

    interface $$Props extends HTMLInputAttributes {
        id: string;
        label: string;
        description?: string | undefined;
        recommended?: boolean;
        inline?: boolean;
        value?: any;
        checked?: boolean;
    }

    export let id: string;
    export let label: string;
    export let description: string | undefined = undefined;

    export let recommended = false;
    export let inline = false;

    // Bindables
    export let value: any = undefined;
    export let checked: boolean | undefined = undefined;

    let computedClassName: string;
    $: {
        computedClassName = "option";
        if (inline) computedClassName += " option--inline";
        if ($$restProps.class) computedClassName += ` ${$$restProps.class}`;
    }
</script>

<div class={computedClassName}>
    <!--
    This is pretty awful, not a good fit for CSS reordering. Would use snippets,
    but this Svelte is too old!
    -->
    {#if inline}
        <div class="option__control">
            {#if $$restProps.type === "checkbox"}
                <input {id} type="checkbox" bind:checked={checked} {...$$restProps} />
            {:else}
                <input {id} bind:value={value} {...$$restProps} />
            {/if}
        </div>
        <label class="option__label" for={id}>
            {label}
            {#if recommended}
                <span class="option__recommended">
                    {_("optionsOptionRecommended")}
                </span>
            {/if}
            <slot name="label" />
        </label>
        {#if description}
            <div class="option__description">
                {description}
                <slot name="description" />
            </div>
        {/if}
    {:else}
        <label class="option__label" for={id}>
            {label}
            {#if recommended}
                <span class="option__recommended">
                    {_("optionsOptionRecommended")}
                </span>
            {/if}
            <slot name="label" />
        </label>
        <div class="option__control">
            {#if $$restProps.type === "checkbox"}
                <input {id} type="checkbox" bind:checked={checked} {...$$restProps} />
            {:else}
                <input {id} bind:value={value} {...$$restProps} />
            {/if}
            {#if description}
                <div class="option__description">
                    {description}
                    <slot name="description" />
                </div>
            {/if}
        </div>
    {/if}
</div>
