<script module lang="ts">
	let bodyScrollLocks = 0;
	let sheetZCounter = 50;
	let originalBodyOverflow = "";

	function lockBodyScroll() {
		if (typeof document === "undefined") return;
		bodyScrollLocks += 1;
		if (bodyScrollLocks === 1) {
			originalBodyOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
		}
	}

	function unlockBodyScroll() {
		if (typeof document === "undefined") return;
		bodyScrollLocks = Math.max(0, bodyScrollLocks - 1);
		if (bodyScrollLocks === 0) document.body.style.overflow = originalBodyOverflow;
	}

	export function nextSheetZ() {
		return ++sheetZCounter;
	}
</script>

<script lang="ts">
	import type { Snippet } from "svelte";
	import type { Attachment } from "svelte/attachments";
	import Button from "../action/button.svelte";
	import { cn } from "../utils.js";

	const portal: Attachment = (node) => {
		if (typeof document === "undefined") return;

		document.body.appendChild(node);

		return () => {
			node.remove();
		};
	};

	type Props = {
		open?: boolean;
		onClose?: () => void;
		modal?: boolean;
		title?: string;
		unmount?: boolean;
		containerClass?: string;
		class?: string;
		headerClass?: string;
		children?: Snippet;
		closeOnEsc?: boolean;
		closeOnClickOutside?: boolean;
		closeIcon?: Snippet;
	};

	let {
		open = $bindable(false),
		onClose,
		modal = false,
		title,
		unmount = false,
		containerClass = "",
		class: className = "",
		headerClass = "",
		children,
		closeOnEsc = true,
		closeOnClickOutside = true,
		closeIcon,
	}: Props = $props();

	let hasBodyLock = false;
	let zIndex = $state(50);

	$effect(() => {
		if (open) {
			zIndex = nextSheetZ();
			if (!hasBodyLock) {
				lockBodyScroll();
				hasBodyLock = true;
			}
		}

		if (!open && hasBodyLock) {
			unlockBodyScroll();
			hasBodyLock = false;
		}

		return () => {
			if (hasBodyLock) {
				unlockBodyScroll();
				hasBodyLock = false;
			}
		};
	});

	function handleClose() {
		if (!open) return;
		open = false;
		onClose?.();
	}

	let rootClasses = $derived(cn("fixed inset-0", open ? "" : "hidden", containerClass));

	let panelClasses = $derived(
		cn(
			"absolute z-10 w-full max-h-[85vh] overflow-auto rounded-t-xl bg-base-300 p-5 pb-7 shadow-2xl sm:p-6 sm:pb-8",
			modal
				? "inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-base-content/8"
				: "inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-dvh sm:max-w-sm sm:rounded-none",
			className,
		),
	);

	let closeButtonClasses = $derived(
		"absolute top-4 right-4 z-10 h-8 w-8 bg-base-content/10 p-0 text-base-content/50 hover:bg-base-content/20 hover:text-base-content",
	);

	let headerClasses = $derived(cn("mb-5 pr-12", headerClass));
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && closeOnEsc && open && handleClose()} />

{#if !unmount || open}
	{@render mainContent()}
{/if}

{#snippet mainContent()}
	<div {@attach portal} class={rootClasses} style="z-index: {zIndex}" role="presentation">
		<div
			class="absolute inset-0 bg-base-content/10 backdrop-blur-sm"
			onclick={() => closeOnClickOutside && handleClose()}
			aria-hidden="true"
		></div>

		<div class={panelClasses} role="dialog" aria-modal={modal ? "true" : undefined}>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class={closeButtonClasses}
				onclick={handleClose}
				aria-label="Close"
			>
				{#if closeIcon}
					{@render closeIcon()}
				{:else}
					<span class="text-xl leading-none" aria-hidden="true">&times;</span>
				{/if}
			</Button>

			{#if title}
				<header class={headerClasses}>
					<h2 class="min-w-0 text-base font-semibold tracking-tight text-base-content">
						{title}
					</h2>
				</header>
			{/if}

			{@render children?.()}
		</div>
	</div>
{/snippet}
