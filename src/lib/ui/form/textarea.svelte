<script lang="ts">
	import type { HTMLTextareaAttributes } from "svelte/elements";
	import { cn } from "../utils.js";
	import ControlShell, { type ControlSlot } from "./control-shell.svelte";
	import Field from "./field.svelte";
	import type { InputSize } from "./input.svelte";

	export type TextareaProps = {
		label?: string;
		error?: string;
		hint?: string;
		validator?: boolean;
		validatorHint?: string;
		value?: string;
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
		onChange?: (value: string | undefined) => void;
		unstyled?: boolean;
	} & Omit<HTMLTextareaAttributes, "value" | "class" | "prefix">;

	const sizeClasses: Record<InputSize, string> = {
		xs: "textarea-xs",
		sm: "textarea-sm",
		md: "",
		lg: "textarea-lg",
		xl: "textarea-xl",
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
		required = false,
		rows = 4,
		oninput,
		...rest
	}: TextareaProps = $props();

	let id = $derived(propId ?? fallbackId);
	let validates = $derived(validator ?? !!validatorHint);
	let describedBy = $derived(error ? `${id}-error` : validatorHint ? `${id}-validator-hint` : hint ? `${id}-hint` : undefined);
	let textareaClasses = $derived(cn(!unstyled && "textarea w-full", !unstyled && sizeClasses[size], !unstyled && error && "textarea-error", inputClass));
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
		kind="join"
		{prefix}
		{suffix}
		class={controlClass}
		controlClass={textareaClasses}
		{prefixClass}
		{suffixClass}
		validator={validates}
		{unstyled}
	>
		{#snippet children(controlClass)}
			<textarea
				{id}
				{required}
				{rows}
				bind:value
				aria-invalid={error ? "true" : undefined}
				aria-describedby={describedBy}
				class={controlClass}
				oninput={(event) => {
					oninput?.(event);
					onChange?.(value);
				}}
				{...rest}
			></textarea>
		{/snippet}
	</ControlShell>
</Field>
