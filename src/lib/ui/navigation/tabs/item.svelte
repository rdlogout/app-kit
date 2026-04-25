<script lang="ts">
	import { getContext } from "svelte";
	import type { Component, Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { cn } from "../../utils.js";
	import type { TabsContext } from "./root.svelte";

	export type TabItemProps = {
		id?: string;
		title: string;
		icon?: Component;
		disabled?: boolean;
		class?: string;
		triggerClass?: string;
		contentClass?: string;
		iconClass?: string;
		onActive?: (index: number, id?: string) => void;
		children?: Snippet;
		unstyled?: boolean;
	};

	type Props = TabItemProps & Omit<HTMLButtonAttributes, keyof TabItemProps | "type">;

	const ctx = getContext<TabsContext>("app-kit-tabs");
	const index = ctx.register();

	let {
		id,
		title,
		icon: Icon,
		disabled = false,
		class: className = "",
		triggerClass = "",
		contentClass = "",
		iconClass = "",
		onActive,
		children,
		unstyled = false,
		onclick,
		...rest
	}: Props = $props();

	let isActive = $derived(ctx.activeIndex() === index);
	let variant = $derived(ctx.variant());
	let isUnstyled = $derived(unstyled || ctx.unstyled());
	let triggerClasses = $derived.by(() => {
		if (isUnstyled) return cn(ctx.triggerClass(), triggerClass, className);

		if (variant === "pills") {
			return cn(
				"order-1 inline-flex cursor-pointer items-center gap-2 rounded-field bg-transparent px-4 py-2.5 text-sm font-medium transition-[background-color,color,opacity]",
				isActive ? "bg-primary text-primary-content hover:bg-primary" : "text-base-content/60 hover:bg-base-200 hover:text-base-content",
				disabled && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-base-content/60",
				ctx.triggerClass(),
				triggerClass,
				className,
			);
		}

		return cn(
			"-mb-px order-1 relative inline-flex cursor-pointer items-center gap-2 border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm font-medium transition-[color,border-color,opacity]",
			isActive ? "border-primary text-primary hover:border-primary hover:text-primary" : "text-base-content/55 hover:border-base-content/20 hover:text-base-content",
			disabled && "cursor-not-allowed opacity-50 hover:border-transparent hover:text-base-content/55",
			ctx.triggerClass(),
			triggerClass,
			className,
		);
	});
	let contentClasses = $derived(
		cn(!isUnstyled && (variant === "pills" ? "order-3 w-full pt-4" : "order-3 w-full pt-6"), ctx.contentClass(), contentClass, !isActive && "hidden"),
	);
</script>

<button
	type="button"
	role="tab"
	aria-selected={isActive}
	tabindex={isActive ? 0 : -1}
	{disabled}
	class={triggerClasses}
	onclick={(event) => {
		onclick?.(event);
		if (event.defaultPrevented || disabled) return;
		if (ctx.activate(index, id)) onActive?.(index, id);
	}}
	{...rest}
>
	{#if Icon}
		<Icon class={cn(!isUnstyled && "h-4 w-4", iconClass)} />
	{/if}
	{title}
</button>

{#if children}
	<div role="tabpanel" class={contentClasses}>
		{@render children()}
	</div>
{/if}
