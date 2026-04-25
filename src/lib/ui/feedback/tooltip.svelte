<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../utils.js";

	type Placement = "top" | "bottom" | "left" | "right";

	type TooltipProps = {
		class?: string;
		contentClass?: string;
		children?: Snippet;
		content?: string | Snippet;
		placement?: Placement;
		enabled?: boolean;
		unstyled?: boolean;
	};

	type Props = TooltipProps & HTMLAttributes<HTMLDivElement>;

	let {
		class: className = "",
		contentClass = "",
		children,
		content,
		placement = "top",
		enabled = true,
		unstyled = false,
		...rest
	}: Props = $props();

	let classes = $derived(cn(unstyled || !enabled ? "" : `tooltip tooltip-${placement}`, className));
	let tooltipContentClass = $derived(cn(unstyled ? "" : "tooltip-content", contentClass));
</script>

<div class={classes} data-tip={enabled && typeof content === "string" ? content : undefined} {...rest}>
	{@render children?.()}

	{#if enabled && typeof content !== "string" && content}
		<div class={tooltipContentClass} role="tooltip">
			{@render content()}
		</div>
	{/if}
</div>
