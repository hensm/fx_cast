<script lang="ts">
    export let name: string;
    export let description: string;
</script>

<fieldset class="category">
    <legend class="category__name">
        <h2>{name}</h2>
    </legend>
    <p class="category__description">
        {description}
    </p>

    <slot />
</fieldset>
