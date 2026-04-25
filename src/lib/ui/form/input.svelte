<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { cn } from "../utils.js";
	import ControlShell, { type ControlSlot } from "./control-shell.svelte";
	import Field from "./field.svelte";

	export type InputSize = "xs" | "sm" | "md" | "lg" | "xl";
	export type InputValue = string | number | readonly string[] | undefined;

	export type InputProps = {
		label?: string;
		error?: string;
		hint?: string;
		validator?: boolean;
		validatorHint?: string;
		value?: InputValue;
		size?: InputSize;
		prefix?: ControlSlot;
		suffix?: ControlSlot;
		class?: string;
		controlClass?: string;
		inputClass?: string;
		prefixClass?: string;
		suffixClass?: string;
		labelClass?: string;
		hintClass?: string;
		errorClass?: string;
		validatorHintClass?: string;
		onChange?: (value: InputValue) => void;
		unstyled?: boolean;
	} & Omit<HTMLInputAttributes, "size" | "value" | "class" | "prefix">;

	const sizeClasses: Record<InputSize, string> = {
		xs: "input-xs",
		sm: "input-sm",
		md: "",
		lg: "input-lg",
		xl: "input-xl",
	};

	const fallbackId = $props.id();

	let {
		label,
		error,
		hint,
		validator,
		validatorHint,
		value = $bindable(),
		size = "md",
		prefix,
		suffix,
		class: className = "",
		controlClass = "",
		inputClass = "",
		prefixClass = "",
		suffixClass = "",
		labelClass = "",
		hintClass = "",
		errorClass = "",
		validatorHintClass = "",
		onChange,
		unstyled = false,
		id: propId,
		type = "text",
		required = false,
		oninput,
		...rest
	}: InputProps = $props();

	let id = $derived(propId ?? fallbackId);
	let validates = $derived(validator ?? !!validatorHint);
	let describedBy = $derived(error ? `${id}-error` : validatorHint ? `${id}-validator-hint` : hint ? `${id}-hint` : undefined);
	let shellClasses = $derived(cn(!unstyled && sizeClasses[size], !unstyled && error && "input-error", controlClass));
	let innerClasses = $derived(
		cn(
			!unstyled && "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
			inputClass,
		),
	);
</script>

<Field
	{id}
	{label}
	{error}
	{hint}
	{validatorHint}
	required={required ?? false}
	class={className}
	{labelClass}
	{hintClass}
	{errorClass}
	{validatorHintClass}
	{unstyled}
>
	<ControlShell
		kind="input"
		{prefix}
		{suffix}
		class={shellClasses}
		controlClass={innerClasses}
		{prefixClass}
		{suffixClass}
		validator={validates}
		{unstyled}
	>
		{#snippet children(controlClass)}
			<input
				{id}
				{type}
				{required}
				bind:value
				aria-invalid={error ? "true" : undefined}
				aria-describedby={describedBy}
				class={controlClass}
				oninput={(event) => {
					oninput?.(event);
					onChange?.(value);
				}}
				{...rest}
			/>
		{/snippet}
	</ControlShell>
</Field>
