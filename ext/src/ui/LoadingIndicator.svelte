<script lang="ts">
    import { onMount } from "svelte";

    function getNextEllipsis(ellipsis: string): string {
        if (ellipsis === "") return ".";
        if (ellipsis === ".") return "..";
        if (ellipsis === "..") return "...";
        if (ellipsis === "...") return "";

        return "";
    }

    export let interval = 500;

    let ellipsis = "";
    let intervalId: number;

    onMount(() => {
        intervalId = window.setInterval(() => {
            ellipsis = getNextEllipsis(ellipsis);
        }, interval);

        return () => {
            window.clearInterval(intervalId);
        };
    });
</script>

<span class="ellipsis">{ellipsis}</span>
