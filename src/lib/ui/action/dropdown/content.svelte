<script lang="ts">
	import { getContext } from "svelte";
	import type { Snippet } from "svelte";
	import { cn } from "../../utils.js";
	import type { DropdownContext } from "./root.svelte";

	type Props = {
		class?: string;
		children?: Snippet<[{ close: () => void }]>;
		unstyled?: boolean;
	};

	let { class: className = "", children, unstyled = false }: Props = $props();
	const ctx = getContext<DropdownContext>("app-kit-dropdown");

	let classes = $derived(
		cn(
			unstyled ? "" : "dropdown-content z-50 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl",
			ctx.matchTriggerWidth() && "w-full",
			className,
		),
	);
</script>

<div class={classes}>
	{@render children?.({ close: ctx.close })}
</div>
