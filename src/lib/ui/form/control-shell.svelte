<script lang="ts" module>
	import type { Snippet } from "svelte";

	export type ControlSlot = Snippet | string;
	export type ControlShellKind = "input" | "join";

	export type ControlShellProps = {
		kind?: ControlShellKind;
		prefix?: ControlSlot;
		suffix?: ControlSlot;
		class?: string;
		controlClass?: string;
		prefixClass?: string;
		suffixClass?: string;
		validator?: boolean;
		children?: Snippet<[string]>;
		unstyled?: boolean;
	};
</script>

<script lang="ts">
	import { cn } from "../utils.js";

	let {
		kind = "join",
		prefix,
		suffix,
		class: className = "",
		controlClass = "",
		prefixClass = "",
		suffixClass = "",
		validator = false,
		children,
		unstyled = false,
	}: ControlShellProps = $props();

	let hasPrefix = $derived(prefix !== undefined && prefix !== null && prefix !== "");
	let hasSuffix = $derived(suffix !== undefined && suffix !== null && suffix !== "");
	let hasAddons = $derived(hasPrefix || hasSuffix);
	let rootClasses = $derived(
		cn(
			!unstyled && kind === "input" && "input w-full",
			!unstyled && kind === "join" && hasAddons && "join w-full",
			!unstyled && validator && (kind === "input" || hasAddons) && "validator",
			className,
		),
	);
	let childClasses = $derived(
		cn(
			!unstyled && kind === "input" && "grow",
			!unstyled && kind === "join" && hasAddons && "join-item flex-1",
			!unstyled && kind === "join" && !hasAddons && validator && "validator",
			controlClass,
		),
	);
	let prefixClasses = $derived(
		cn(
			!unstyled && kind === "join" && "join-item flex items-center bg-base-200 px-3 text-sm text-base-content/60",
			!unstyled && kind === "input" && "flex items-center text-base-content/50 [&>svg]:h-[1em]",
			prefixClass,
		),
	);
	let suffixClasses = $derived(
		cn(
			!unstyled && kind === "join" && "join-item flex items-center bg-base-200 px-3 text-sm text-base-content/60",
			!unstyled && kind === "input" && "flex items-center text-base-content/50 [&>svg]:h-[1em]",
			suffixClass,
		),
	);
</script>

{#if kind === "input"}
	<label class={rootClasses}>
		{#if hasPrefix}
			<span class={prefixClasses}>
				{#if typeof prefix === "function"}
					{@render prefix()}
				{:else}{prefix}{/if}
			</span>
		{/if}

		{@render children?.(childClasses)}

		{#if hasSuffix}
			<span class={suffixClasses}>
				{#if typeof suffix === "function"}
					{@render suffix()}
				{:else}{suffix}{/if}
			</span>
		{/if}
	</label>
{:else if hasAddons}
	<div class={rootClasses}>
		{#if hasPrefix}
			<span class={prefixClasses}>
				{#if typeof prefix === "function"}
					{@render prefix()}
				{:else}{prefix}{/if}
			</span>
		{/if}

		{@render children?.(childClasses)}

		{#if hasSuffix}
			<span class={suffixClasses}>
				{#if typeof suffix === "function"}
					{@render suffix()}
				{:else}{suffix}{/if}
			</span>
		{/if}
	</div>
{:else}
	{@render children?.(childClasses)}
{/if}
