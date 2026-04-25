<script lang="ts" module>
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	export type TabVariant = "underlined" | "pills";

	export type TabsContext = {
		register: () => number;
		activeIndex: () => number;
		variant: () => TabVariant;
		unstyled: () => boolean;
		triggerClass: () => string;
		contentClass: () => string;
		activate: (index: number, id?: string) => boolean;
	};

	export type TabsProps = {
		activeIndex?: number;
		defaultActiveIndex?: number;
		variant?: TabVariant;
		class?: string;
		triggerClass?: string;
		contentClass?: string;
		onChange?: (index: number, id?: string) => void;
		children?: Snippet;
		unstyled?: boolean;
	};
</script>

<script lang="ts">
	import { setContext } from "svelte";
	import { cn } from "../../utils.js";

	type Props = TabsProps & HTMLAttributes<HTMLDivElement>;

	let totalTabs = $state(0);

	let {
		defaultActiveIndex = 0,
		activeIndex = $bindable(defaultActiveIndex),
		variant = "underlined",
		class: className = "",
		triggerClass = "",
		contentClass = "",
		onChange,
		children,
		unstyled = false,
		...rest
	}: Props = $props();

	let classes = $derived(
		cn(
			!unstyled && (variant === "pills" ? "flex w-full flex-wrap gap-2 bg-transparent" : "flex w-full flex-wrap bg-transparent"),
			className,
		),
	);

	function register() {
		return totalTabs++;
	}

	function activate(index: number, id?: string) {
		if (activeIndex === index) return false;
		activeIndex = index;
		onChange?.(index, id);
		return true;
	}

	setContext<TabsContext>("app-kit-tabs", {
		register,
		activeIndex: () => activeIndex,
		variant: () => variant,
		unstyled: () => unstyled,
		triggerClass: () => triggerClass,
		contentClass: () => contentClass,
		activate,
	});
</script>

<div role="tablist" class={classes} {...rest}>
	{@render children?.()}
	{#if !unstyled && variant === "underlined"}
		<div class="order-2 w-full border-b border-base-300"></div>
	{/if}
</div>
