<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { cn } from "../utils.js";
	import Field from "./field.svelte";
	import type { InputSize } from "./input.svelte";

	export type CheckboxProps = {
		label?: string;
		description?: string;
		error?: string;
		hint?: string;
		validator?: boolean;
		validatorHint?: string;
		value?: boolean;
		size?: InputSize;
		class?: string;
		inputClass?: string;
		labelClass?: string;
		hintClass?: string;
		errorClass?: string;
		validatorHintClass?: string;
		onChange?: (value: boolean) => void;
		unstyled?: boolean;
	} & Omit<HTMLInputAttributes, "size" | "type" | "value" | "checked" | "class">;

	const sizeClasses: Record<InputSize, string> = {
		xs: "checkbox-xs",
		sm: "checkbox-sm",
		md: "",
		lg: "checkbox-lg",
		xl: "checkbox-xl",
	};

	const fallbackId = $props.id();

	let {
		label,
		description,
		error,
		hint,
		validator,
		validatorHint,
		value = $bindable(false),
		size = "md",
		class: className = "",
		inputClass = "",
		labelClass = "",
		hintClass = "",
		errorClass = "",
		validatorHintClass = "",
		onChange,
		unstyled = false,
		id: propId,
		required = false,
		onchange,
		...rest
	}: CheckboxProps = $props();

	let id = $derived(propId ?? fallbackId);
	let fieldHint = $derived(hint ?? description);
	let validates = $derived(validator ?? !!validatorHint);
	let describedBy = $derived(error ? `${id}-error` : validatorHint ? `${id}-validator-hint` : fieldHint ? `${id}-hint` : undefined);
	let classes = $derived(
		cn(!unstyled && "checkbox", !unstyled && sizeClasses[size], !unstyled && validates && "validator", !unstyled && error && "checkbox-error", inputClass),
	);
</script>

<Field
	{id}
	{label}
	error={error}
	hint={fieldHint}
	{validatorHint}
	required={required ?? false}
	class={className}
	{labelClass}
	{hintClass}
	{errorClass}
	{validatorHintClass}
	{unstyled}
>
	<input
		{id}
		type="checkbox"
		{required}
		bind:checked={value}
		aria-invalid={error ? "true" : undefined}
		aria-describedby={describedBy}
		class={classes}
		onchange={(event) => {
			onchange?.(event);
			onChange?.(value);
		}}
		{...rest}
	/>
</Field>
