<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../utils.js";

	type ShimmerElement = "div" | "span";

	type ShimmerProps = {
		as?: ShimmerElement;
		children?: Snippet;
		class?: string;
		unstyled?: boolean;
	};

	type Props = ShimmerProps & HTMLAttributes<HTMLElement>;

	let {
		as = "div",
		children,
		class: className = "",
		unstyled = false,
		...rest
	}: Props = $props();

	let classes = $derived(cn(unstyled ? "" : "animate-pulse rounded-md bg-base-200", className));
</script>

<svelte:element this={as} class={classes} {...rest}>
	{@render children?.()}
</svelte:element>
