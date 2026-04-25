<script lang="ts">
	import { cn } from "../utils.js";

	type LoadingVariant = "spinner" | "dots" | "ring" | "ball" | "bars" | "infinity";
	type LoadingSize = "xs" | "sm" | "md" | "lg";

	export type LoadingProps = {
		variant?: LoadingVariant;
		size?: LoadingSize;
		class?: string;
		unstyled?: boolean;
	};

	let {
		variant = "spinner",
		size = "sm",
		class: className = "",
		unstyled = false,
	}: LoadingProps = $props();

	let classes = $derived(
		cn(unstyled ? "" : `loading loading-${variant} loading-${size}`, className),
	);
</script>

<span class={classes} aria-hidden="true"></span>
