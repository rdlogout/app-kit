<script lang="ts">
	import type { HTMLProgressAttributes } from "svelte/elements";
	import { cn } from "../utils.js";

	type Variant = "primary" | "secondary" | "accent" | "success" | "warning" | "error" | "info";
	type Size = "sm" | "md" | "lg";

	type ProgressProps = {
		class?: string;
		value?: number;
		min?: number;
		max?: number;
		variant?: Variant;
		size?: Size;
		unstyled?: boolean;
	};

	type Props = ProgressProps & HTMLProgressAttributes;

	let {
		class: className = "",
		value,
		min = 0,
		max = 100,
		variant = "primary",
		size = "md",
		unstyled = false,
		...rest
	}: Props = $props();

	let current = $derived(value ?? min);
	let normalized = $derived(Math.min(Math.max(current, min), max));
	let classes = $derived(
		cn(unstyled ? "" : `progress progress-${variant} ${size === "md" ? "" : `progress-${size}`} w-full`, className),
	);
</script>

<progress class={classes} value={normalized} {max} {...rest}></progress>
