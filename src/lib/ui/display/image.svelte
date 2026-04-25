<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../utils.js";

	type ImageMode = "contain" | "cover" | "crop" | "scale-down";
	type ImageFormat = "auto" | "webp" | "avif" | "jpeg" | "png";
	type ImageQuality = "low" | "medium" | "high";

	type ImageProps = {
		src: string;
		alt: string;
		class?: string;
		height?: number | number[];
		width?: number | number[];
		lazy?: boolean;
		mode?: ImageMode;
		quality?: ImageQuality;
		format?: ImageFormat;
		errorFallback?: Snippet;
		unstyled?: boolean;
	};

	type Props = ImageProps & HTMLAttributes<HTMLImageElement>;

	let {
		src,
		alt,
		width,
		height,
		lazy = true,
		mode,
		quality = "medium",
		format = "auto",
		errorFallback,
		unstyled = false,
		...rest
	}: Props = $props();

	let failed = $state(false);
	let resolvedWidth = $derived(typeof width === "number" ? width : width?.[0]);
	let resolvedHeight = $derived(typeof height === "number" ? height : height?.[0]);
	let hasScalarSize = $derived(typeof width === "number" || typeof height === "number");
	let modeClass = $derived(mode === "crop" ? "object-cover" : mode ? `object-${mode}` : undefined);

	$effect(() => {
		src;
		failed = false;
	});

	function withTransform(url: string) {
		if (!url) return url;
		const query: string[] = [];
		if (quality) query.push(`quality=${quality}`);
		if (resolvedWidth) query.push(`width=${resolvedWidth}`);
		if (resolvedHeight) query.push(`height=${resolvedHeight}`);
		if (mode) query.push(`mode=${mode}`);
		if (format !== "auto") query.push(`format=${format}`);
		if (!query.length) return url;
		return `${url}${url.includes("?") ? "&" : "?"}${query.join("&")}`;
	}

	let imageUrl = $derived(withTransform(src));
	let classes = $derived(cn(unstyled ? "" : !hasScalarSize && "h-full w-full", modeClass, rest.class));
	let fallbackClasses = $derived(
		cn(unstyled ? "" : "grid place-items-center rounded-md bg-base-200 text-base-content/40", !hasScalarSize && "h-full w-full", rest.class),
	);
</script>

{#if failed}
	{#if errorFallback}
		{@render errorFallback()}
	{:else}
		<div class={fallbackClasses} role="img" aria-label={alt}>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="3" y1="3" x2="21" y2="21" />
				<path d="M15 8h.01" />
				<path d="M7 3h10a4 4 0 0 1 4 4v10M4 7v10a4 4 0 0 0 4 4h10" />
				<path d="m4 15 4-4c.928-.893 2.072-.893 3 0l5 5" />
				<path d="m14 14 1-1c.928-.893 2.072-.893 3 0" />
			</svg>
		</div>
	{/if}
{:else}
	<img
		{...rest}
		src={imageUrl}
		width={resolvedWidth}
		height={resolvedHeight}
		{alt}
		loading={lazy ? "lazy" : "eager"}
		decoding="async"
		fetchpriority={lazy ? "low" : "high"}
		class={classes}
		onerror={() => {
			failed = true;
		}}
	/>
{/if}
