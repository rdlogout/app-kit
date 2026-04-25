<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import Image from "./image.svelte";
	import { cn } from "../utils.js";

	type Size = "xs" | "sm" | "md" | "lg" | "xl";
	type Shape = "circle" | "rounded" | "square";

	type AvatarProps = {
		src?: string | null;
		name?: string | null;
		alt?: string;
		class?: string;
		imageClass?: string;
		size?: Size;
		shape?: Shape;
		fallback?: string;
		iconFallback?: Snippet;
		unstyled?: boolean;
	};

	type Props = AvatarProps & HTMLAttributes<HTMLDivElement>;

	let {
		src,
		name,
		alt,
		class: className = "",
		imageClass = "",
		size = "md",
		shape = "circle",
		fallback,
		iconFallback,
		unstyled = false,
		...rest
	}: Props = $props();

	let initials = $derived(
		name
			? name
					.split(" ")
					.filter(Boolean)
					.map((part) => part[0])
					.join("")
					.slice(0, 2)
					.toUpperCase()
			: "",
	);

	let sizeClass = $derived.by(() => {
		switch (size) {
			case "xs":
				return "w-6 h-6 text-xs";
			case "sm":
				return "w-8 h-8 text-sm";
			case "lg":
				return "w-14 h-14 text-lg";
			case "xl":
				return "w-20 h-20 text-xl";
			default:
				return "w-10 h-10 text-base";
		}
	});

	let shapeClass = $derived.by(() => {
		switch (shape) {
			case "rounded":
				return "rounded-lg";
			case "square":
				return "rounded-none";
			default:
				return "rounded-full";
		}
	});

	let rootClass = $derived(cn(unstyled ? "" : "avatar", className));
	let frameClass = $derived(cn(unstyled ? "" : "bg-base-300 text-base-content", sizeClass, shapeClass));
	let contentClass = $derived(cn("flex h-full w-full items-center justify-center", !unstyled && "avatar-placeholder"));
</script>

<div class={rootClass} {...rest}>
	<div class={frameClass}>
		{#if src}
			<Image {src} alt={alt ?? name ?? "Avatar"} mode="cover" class={cn("h-full w-full", imageClass)} />
		{:else if initials}
			<div class={contentClass}>
				<span class="font-medium leading-none">{initials}</span>
			</div>
		{:else if fallback}
			<div class={contentClass}>
				<span class="leading-none text-base-content/60">{fallback}</span>
			</div>
		{:else if iconFallback}
			<div class={contentClass}>
				{@render iconFallback()}
			</div>
		{:else}
			<div class={contentClass}>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-2/3 w-2/3 text-base-content/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
					<path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
				</svg>
			</div>
		{/if}
	</div>
</div>
