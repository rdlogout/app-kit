<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLFormAttributes } from "svelte/elements";

	export type FormProps = {
		class?: string;
		children?: Snippet;
		onSubmit?: (event: SubmitEvent) => void | Promise<void>;
	} & Omit<HTMLFormAttributes, "onsubmit">;

	let { children, onSubmit, ...rest }: FormProps = $props();
</script>

<form
	{...rest}
	onsubmit={async (event) => {
		event.preventDefault();
		await onSubmit?.(event);
	}}
>
	{@render children?.()}
</form>
