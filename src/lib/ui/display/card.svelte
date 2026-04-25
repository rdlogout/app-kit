<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../utils.js";

	type CardElement = "section" | "article" | "div";

	type CardProps = {
		as?: CardElement;
		children?: Snippet;
		actions?: Snippet;
		title?: string;
		subtitle?: string;
		class?: string;
		bodyClass?: string;
		titleClass?: string;
		subtitleClass?: string;
		headerClass?: string;
		unstyled?: boolean;
	};

	type Props = CardProps & HTMLAttributes<HTMLElement>;

	let {
		as = "section",
		children,
		actions,
		title,
		subtitle,
		class: className = "",
		bodyClass = "",
		titleClass = "",
		subtitleClass = "",
		headerClass = "",
		unstyled = false,
		...rest
	}: Props = $props();

	let hasHeader = $derived(!!title || !!subtitle || !!actions);
	let rootClass = $derived(cn(unstyled ? "" : "card card-border bg-base-100 shadow-sm", className));
	let contentClass = $derived(cn(unstyled ? "" : "card-body p-5", bodyClass));
</script>

<svelte:element this={as} class={rootClass} {...rest}>
	{#if unstyled}
		{@render children?.()}
	{:else}
		<div class={contentClass}>
			{#if hasHeader}
				<div class={cn("flex items-start justify-between gap-3", headerClass)}>
					<div>
						{#if title}
							<h2 class={cn("card-title text-sm", titleClass)}>{title}</h2>
						{/if}
						{#if subtitle}
							<p class={cn("text-sm text-base-content/60", subtitleClass)}>{subtitle}</p>
						{/if}
					</div>

					{@render actions?.()}
				</div>
			{/if}

			{@render children?.()}
		</div>
	{/if}
</svelte:element>
