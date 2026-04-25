<script lang="ts">
	import { getContext } from "svelte";
	import Button, { type ButtonProps } from "../button.svelte";
	import type { DropdownContext } from "./root.svelte";

	type Props = ButtonProps;

	let { onclick, type = "button", ...props }: Props = $props();
	const ctx = getContext<DropdownContext>("app-kit-dropdown");
</script>

<Button
	{type}
	{...props}
	onclick={(event) => {
		onclick?.(event);
		if (event.defaultPrevented || ctx.isHover()) return;
		ctx.toggle();
	}}
/>
