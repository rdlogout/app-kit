<script lang="ts" module>
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	export type FieldProps = {
		id?: string;
		label?: string;
		error?: string;
		hint?: string;
		validatorHint?: string;
		required?: boolean;
		class?: string;
		labelClass?: string;
		hintClass?: string;
		errorClass?: string;
		validatorHintClass?: string;
		children?: Snippet;
		unstyled?: boolean;
	};
</script>

<script lang="ts">
	import { cn } from "../utils.js";

	type Props = FieldProps & HTMLAttributes<HTMLFieldSetElement>;

	let {
		id,
		label,
		error,
		hint,
		validatorHint,
		required = false,
		class: className = "",
		labelClass = "",
		hintClass = "",
		errorClass = "",
		validatorHintClass = "",
		children,
		unstyled = false,
		...rest
	}: Props = $props();

	let classes = $derived(cn(!unstyled && "fieldset w-full", className));
	let labelClasses = $derived(cn(!unstyled && "fieldset-legend", labelClass));
	let hintClasses = $derived(cn(!unstyled && "label", hintClass));
	let errorClasses = $derived(cn(!unstyled && "label text-error", errorClass));
	let validatorHintClasses = $derived(cn(!unstyled && "validator-hint", validatorHintClass));
</script>

<fieldset class={classes} {...rest}>
	{#if label}
		<label for={id} class={labelClasses}>
			{label}
			{#if required}<span class="text-error">*</span>{/if}
		</label>
	{/if}

	{@render children?.()}

	{#if error}
		<p id={id ? `${id}-error` : undefined} class={errorClasses}>{error}</p>
	{:else if validatorHint}
		<p id={id ? `${id}-validator-hint` : undefined} class={validatorHintClasses}>{validatorHint}</p>
	{:else if hint}
		<p id={id ? `${id}-hint` : undefined} class={hintClasses}>{hint}</p>
	{/if}
</fieldset>
