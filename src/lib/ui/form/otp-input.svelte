<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { cn } from "../utils.js";
	import Field from "./field.svelte";
	import type { InputSize } from "./input.svelte";

	export type OtpInputProps = {
		label?: string;
		error?: string;
		hint?: string;
		validator?: boolean;
		validatorHint?: string;
		value?: string;
		length?: number;
		size?: InputSize;
		class?: string;
		inputClass?: string;
		labelClass?: string;
		hintClass?: string;
		errorClass?: string;
		validatorHintClass?: string;
		onChange?: (value: string) => void;
		onComplete?: (value: string) => void;
		autoFocus?: boolean;
		unstyled?: boolean;
	} & Omit<HTMLInputAttributes, "size" | "type" | "value" | "class" | "checked" | "maxlength">;

	const sizeClasses: Record<InputSize, string> = {
		xs: "h-8 w-8 text-sm",
		sm: "h-10 w-10 text-base",
		md: "h-12 w-12 text-xl",
		lg: "h-14 w-14 text-2xl",
		xl: "h-16 w-16 text-3xl",
	};

	function normalizeLength(length: number) {
		return Math.max(1, Math.floor(length || 1));
	}

	function toSlots(source: string | undefined, size: number) {
		const digits = (source ?? "").replace(/\D/g, "").slice(0, size).split("");
		return Array.from({ length: size }, (_, index) => digits[index] ?? "");
	}

	function sameSlots(a: string[], b: string[]) {
		return a.length === b.length && a.every((value, index) => value === b[index]);
	}

	const fallbackId = $props.id();

	let {
		label,
		error,
		hint,
		validator,
		validatorHint,
		value = $bindable(""),
		length = 6,
		size = "md",
		class: className = "",
		inputClass = "",
		labelClass = "",
		hintClass = "",
		errorClass = "",
		validatorHintClass = "",
		onChange,
		onComplete,
		autoFocus = false,
		unstyled = false,
		id: propId,
		name,
		disabled = false,
		required = false,
		oninput,
		onkeydown,
		onpaste,
		...rest
	}: OtpInputProps = $props();

	let id = $derived(propId ?? fallbackId);
	let normalizedLength = $derived(normalizeLength(length));
	let slots = $state<string[]>([]);
	let validates = $derived(validator ?? !!validatorHint);
	let describedBy = $derived(error ? `${id}-error` : validatorHint ? `${id}-validator-hint` : hint ? `${id}-hint` : undefined);
	let renderedSlots = $derived(slots.length === normalizedLength ? slots : toSlots(value, normalizedLength));
	let groupClasses = $derived(cn(!unstyled && "flex flex-wrap justify-start gap-2"));
	let cellClasses = $derived(
		cn(
			!unstyled &&
				"rounded-field border border-base-content/10 bg-base-100 p-0 text-center font-semibold leading-none text-base-content outline-none transition-colors focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
			!unstyled && sizeClasses[size],
			!unstyled && validates && "validator",
			!unstyled && error && "border-error focus-visible:border-error",
			inputClass,
		),
	);

	$effect(() => {
		const next = toSlots(value, normalizedLength);
		if (!sameSlots(slots, next)) slots = next;
	});

	$effect(() => {
		if (!autoFocus || disabled) return;
		const timeout = setTimeout(() => focusInput(0), 250);
		return () => clearTimeout(timeout);
	});

	function focusInput(index: number) {
		const input = document.getElementById(`${id}-${index}`) as HTMLInputElement | null;
		input?.focus();
		input?.select();
	}

	function commit(next: string[]) {
		slots = next;
		value = next.join("");
		onChange?.(value);
		if (value.length === normalizedLength) onComplete?.(value);
	}

	function onInput(index: number, event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		oninput?.(event);
		const input = event.currentTarget as HTMLInputElement;
		const raw = input.value.replace(/\D/g, "");

		if (raw.length > 1) {
			commit(toSlots(raw, normalizedLength));
			focusInput(Math.min(raw.length, normalizedLength) - 1);
			return;
		}

		const next = [...renderedSlots];
		next[index] = raw.slice(0, 1);
		commit(next);

		if (next[index] && index < normalizedLength - 1) focusInput(index + 1);
	}

	function onKeydown(index: number, event: KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		onkeydown?.(event);
		if (event.defaultPrevented) return;
		if (event.key === "Backspace" && !slots[index] && index > 0) focusInput(index - 1);
	}

	function onPaste(event: ClipboardEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		onpaste?.(event);
		if (event.defaultPrevented) return;

		const paste = event.clipboardData?.getData("text").replace(/\D/g, "").slice(0, normalizedLength);
		if (!paste) return;

		event.preventDefault();
		commit(toSlots(paste, normalizedLength));
		focusInput(Math.min(paste.length, normalizedLength) - 1);
	}
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
	<div class={groupClasses}>
		{#each renderedSlots as _, index}
			<input
				{...rest}
				id={`${id}-${index}`}
				type="text"
				dir="ltr"
				inputmode="numeric"
				autocomplete="one-time-code"
				maxlength="1"
				{disabled}
				{required}
				value={renderedSlots[index]}
				aria-invalid={error ? "true" : undefined}
				aria-describedby={describedBy}
				class={cellClasses}
				oninput={(event) => onInput(index, event)}
				onkeydown={(event) => onKeydown(index, event)}
				onpaste={onPaste}
			/>
		{/each}
	</div>

	{#if name}
		<input type="hidden" {name} {value} />
	{/if}
</Field>
