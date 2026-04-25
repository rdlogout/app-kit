<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLSelectAttributes } from "svelte/elements";
	import { cn } from "../utils.js";
	import ControlShell, { type ControlSlot } from "./control-shell.svelte";
	import Field from "./field.svelte";
	import type { InputSize } from "./input.svelte";

	export type SelectOption = { label: string; value: unknown };

	export type SelectProps = {
		label?: string;
		error?: string;
		hint?: string;
		validator?: boolean;
		validatorHint?: string;
		value?: unknown;
		options?: SelectOption[];
		children?: Snippet;
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
		onChange?: (value: unknown) => void;
		unstyled?: boolean;
	} & Omit<HTMLSelectAttributes, "size" | "value" | "class" | "prefix">;

	const sizeClasses: Record<InputSize, string> = {
		xs: "select-xs",
		sm: "select-sm",
		md: "",
		lg: "select-lg",
		xl: "select-xl",
	};

	const fallbackId = $props.id();

	let {
		label,
		error,
		hint,
		validator,
		validatorHint,
		value = $bindable(),
		options = [],
		children: optionChildren,
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
		onchange,
		...rest
	}: SelectProps = $props();

	let id = $derived(propId ?? fallbackId);
	let validates = $derived(validator ?? !!validatorHint);
	let describedBy = $derived(error ? `${id}-error` : validatorHint ? `${id}-validator-hint` : hint ? `${id}-hint` : undefined);
	let selectClasses = $derived(cn(!unstyled && "select w-full", !unstyled && sizeClasses[size], !unstyled && error && "select-error", inputClass));
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
		controlClass={selectClasses}
		{prefixClass}
		{suffixClass}
		validator={validates}
		{unstyled}
	>
		{#snippet children(controlClass)}
			<select
				{id}
				{required}
				bind:value
				aria-invalid={error ? "true" : undefined}
				aria-describedby={describedBy}
				class={controlClass}
				onchange={(event) => {
					onchange?.(event);
					onChange?.(value);
				}}
				{...rest}
			>
				{@render optionChildren?.()}
				{#each options as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		{/snippet}
	</ControlShell>
</Field>
