<script lang="ts">
	import type { Component, Snippet } from "svelte";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes, HTMLLabelAttributes } from "svelte/elements";
	import Loading, { type LoadingProps } from "../feedback/loading.svelte";
	import { cn } from "../utils.js";

	export type ButtonVariant =
		| "primary"
		| "secondary"
		| "accent"
		| "neutral"
		| "success"
		| "warning"
		| "error"
		| "info"
		| "ghost"
		| "outline"
		| "link";
	export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
	export type ButtonElement = "button" | "a" | "label";

	type ButtonOwnProps = {
		children?: Snippet;
		type?: "button" | "submit" | "reset";
		as?: ButtonElement;
		href?: string;
		disabled?: boolean;
		loading?: boolean;
		loadingProps?: LoadingProps;
		variant?: ButtonVariant;
		size?: ButtonSize;
		outline?: boolean;
		wide?: boolean;
		block?: boolean;
		square?: boolean;
		circle?: boolean;
		icon?: Component;
		class?: string;
		unstyled?: boolean;
	};

	export type ButtonProps = ButtonOwnProps &
		HTMLButtonAttributes &
		Omit<HTMLAnchorAttributes, keyof HTMLButtonAttributes> &
		Omit<HTMLLabelAttributes, keyof HTMLButtonAttributes>;

	let {
		children,
		type = "button",
		as,
		href,
		disabled = false,
		loading = false,
		loadingProps = {},
		variant = "ghost",
		size,
		outline = false,
		wide = false,
		block = false,
		square = false,
		circle = false,
		icon,
		class: className = "",
		unstyled = false,
		...rest
	}: ButtonProps = $props();

	let element = $derived(as ?? (href ? "a" : "button"));
	let isButton = $derived(element === "button");
	let isAnchor = $derived(element === "a");
	let isDisabled = $derived(disabled || loading);
	let variantClass = $derived.by(() => {
		if (outline && variant !== "ghost" && variant !== "link") return `btn-outline btn-${variant}`;
		return `btn-${variant}`;
	});
	let classes = $derived(
		unstyled
			? className
			: cn(
					"btn",
					variantClass,
					size && `btn-${size}`,
					wide && "btn-wide",
					block && "btn-block",
					square && "btn-square",
					circle && "btn-circle",
					className,
				),
	);
</script>

<svelte:element
	this={element}
	type={isButton ? type : undefined}
	href={isAnchor ? href : undefined}
	disabled={isButton ? isDisabled : undefined}
	aria-disabled={!isButton && isDisabled ? "true" : undefined}
	aria-busy={loading ? "true" : undefined}
	class={classes}
	{...rest}
>
	{#if loading}
		<Loading size="xs" {...loadingProps} />
	{:else if icon}
		{@const Icon = icon as Component}
		<Icon />
	{:else}
		{@render children?.()}
	{/if}
</svelte:element>
