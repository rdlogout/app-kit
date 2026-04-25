<script lang="ts">
	import { afterNavigate, beforeNavigate } from "$app/navigation";
	import { onDestroy } from "svelte";
	import { cn } from "../utils.js";

    export type NavIndicatorProps = {
        class?: string;
    };

    let { class: className = "" }: NavIndicatorProps = $props();
    let visible = $state(false);
    let timer: ReturnType<typeof setTimeout> | undefined;

    function clear() {
        if (timer) clearTimeout(timer);
        timer = undefined;
    }

    beforeNavigate(() => {
        clear();
        timer = setTimeout(() => (visible = true), 250);
    });

    afterNavigate(() => {
        clear();
        visible = false;
    });

    onDestroy(clear);
</script>

{#if visible}
	<div class="pointer-events-none fixed inset-x-0 top-0 z-50">
		<progress class={cn("h-1 w-full rounded-none bg-primary", className)}></progress>
	</div>
{/if}
