<script lang="ts" module>
	export type DropdownContext = {
		isHover: () => boolean;
		matchTriggerWidth: () => boolean;
		close: () => void;
		toggle: () => void;
	};
</script>

<script lang="ts">
	import { setContext } from "svelte";
	import type { Snippet } from "svelte";
	import { cn } from "../../utils.js";

	type Position = "top" | "bottom" | "left" | "right";
	type Align = "start" | "end" | "center";

	type Props = {
		open?: boolean;
		position?: Position;
		align?: Align;
		hover?: boolean;
		closeOnClickOutside?: boolean;
		matchTriggerWidth?: boolean;
		onOpen?: () => void;
		onClose?: () => void;
		class?: string;
		unstyled?: boolean;
		children?: Snippet;
	};

	let {
		open = $bindable(false),
		position = "bottom",
		align = "start",
		hover = false,
		closeOnClickOutside = true,
		matchTriggerWidth = false,
		onOpen,
		onClose,
		class: className = "",
		unstyled = false,
		children,
	}: Props = $props();

	let rootEl = $state<HTMLElement | undefined>();
	let alignClass = $derived(
		align === "end" ? "dropdown-end" : align === "center" ? "dropdown-center" : "dropdown-start",
	);
	let classes = $derived(
		cn(
			unstyled ? "" : "dropdown",
			!unstyled && `dropdown-${position}`,
			!unstyled && alignClass,
			!unstyled && hover && "dropdown-hover",
			!unstyled && open && "dropdown-open",
			matchTriggerWidth && "w-full",
			className,
		),
	);

	function close() {
		if (!open) return;
		open = false;
		onClose?.();
	}

	function toggle() {
		open = !open;
		open ? onOpen?.() : onClose?.();
	}

	setContext<DropdownContext>("app-kit-dropdown", {
		isHover: () => hover,
		matchTriggerWidth: () => matchTriggerWidth,
		close,
		toggle,
	});

	$effect(() => {
		if (typeof window === "undefined" || !closeOnClickOutside || !open) return;

		function onClick(event: MouseEvent) {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (rootEl?.contains(target)) return;
			close();
		}

		window.addEventListener("click", onClick);
		return () => window.removeEventListener("click", onClick);
	});
</script>

<div bind:this={rootEl} class={classes}>
	{@render children?.()}
</div>
