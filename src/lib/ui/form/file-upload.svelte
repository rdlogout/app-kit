<script lang="ts" module>
	export type FileUploadValue = string | string[] | undefined;

	export type FileUploadProps = {
		value?: FileUploadValue;
		uploadUrl?: string;
		name?: string;
		multiple?: boolean;
		accept?: string;
		maxItems?: number;
		required?: boolean;
		class?: string;
		onChange?: (value: FileUploadValue) => void;
		onError?: (error: Error, file: File) => void;
		unstyled?: boolean;
	};
</script>

<script lang="ts">
	import { cn } from "../utils.js";

	type FileEntry = {
		id: string;
		url?: string;
		name: string;
		type: string;
		size: number;
		uploading?: boolean;
	};

	let {
		value = $bindable(),
		uploadUrl = "/api/file-upload",
		name = "file",
		multiple = false,
		accept,
		maxItems = 10,
		required = false,
		class: className = "",
		onChange,
		onError,
		unstyled = false,
	}: FileUploadProps = $props();

	let files = $state<FileEntry[]>([]);
	let dragging = $state(false);
	let inputRef = $state<HTMLInputElement>();

	let classes = $derived(
		cn(
			!unstyled &&
				"group relative flex min-h-36 w-full cursor-pointer flex-col items-center justify-center rounded-box border border-dashed border-base-300 bg-transparent p-4 text-center transition-colors hover:border-primary/50 hover:bg-base-200/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
			!unstyled && dragging && "border-primary bg-primary/5",
			!unstyled && files.length > 0 && !multiple && "border-solid p-0",
			className,
		),
	);

	$effect(() => {
		if (files.length > 0 || !value) return;
		const urls = Array.isArray(value) ? value : [value];
		files = urls.filter(Boolean).map((url) => ({
			id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
			url,
			name: url.split("/").pop() || "file",
			type: inferType(url),
			size: 0,
		}));
	});

	function inferType(url: string) {
		if (/\.(avif|gif|jpe?g|png|svg|webp)$/i.test(url)) return "image/*";
		if (/\.(mp4|ogg|webm)$/i.test(url)) return "video/*";
		return "application/octet-stream";
	}

	function accepts(file: File) {
		if (!accept) return true;
		return accept
			.split(",")
			.map((item) => item.trim())
			.some((item) => {
				if (!item) return false;
				if (item.startsWith(".")) return file.name.toLowerCase().endsWith(item.toLowerCase());
				if (item.endsWith("/*")) return file.type.startsWith(`${item.slice(0, -1)}`);
				return file.type === item;
			});
	}

	function reportError(error: Error, file: File) {
		onError?.(error, file);
	}

	function commitValue() {
		const urls = files.map((file) => file.url).filter(Boolean) as string[];
		value = multiple ? urls : urls[0];
		onChange?.(value);
	}

	async function upload(file: File, entryId: string) {
		const formData = new FormData();
		formData.set("file", file);

		try {
			const response = await fetch(uploadUrl, { method: "POST", body: formData });
			if (!response.ok) throw new Error(`Upload failed with HTTP ${response.status}`);

			const payload = (await response.json()) as { url?: string };
			if (!payload.url) throw new Error("Upload response is missing a url");

			files = files.map((entry) => (entry.id === entryId ? { ...entry, url: payload.url, uploading: false } : entry));
		} catch (error) {
			files = files.filter((entry) => entry.id !== entryId);
			reportError(error instanceof Error ? error : new Error("Upload failed"), file);
		}
	}

	async function handleFiles(fileList: FileList | File[]) {
		let selected = Array.from(fileList);
		selected = selected.filter((file) => {
			const valid = accepts(file);
			if (!valid) reportError(new Error(`File type is not accepted: ${file.name}`), file);
			return valid;
		});

		if (selected.length === 0) return;

		if (multiple) {
			const remaining = Math.max(0, maxItems - files.length);
			selected = selected.slice(0, remaining);
		} else {
			selected = selected.slice(0, 1);
			files = [];
		}

		if (selected.length === 0) return;

		const entries = selected.map((file) => ({
			id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
			url: URL.createObjectURL(file),
			name: file.name,
			type: file.type,
			size: file.size,
			uploading: true,
		}));

		files = multiple ? [...files, ...entries] : entries;
		await Promise.all(entries.map((entry, index) => upload(selected[index], entry.id)));
		commitValue();
	}

	function remove(index: number) {
		files = files.filter((_, itemIndex) => itemIndex !== index);
		if (inputRef && files.length === 0) inputRef.value = "";
		commitValue();
	}

	function openPicker() {
		if (!multiple && files.length > 0) return;
		inputRef?.click();
	}

	function stop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
	}

	function isImage(type: string) {
		return type.startsWith("image/");
	}

	function formatSize(size: number) {
		if (!size) return "";
		if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
		return `${(size / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<div
	class={classes}
	role="button"
	tabindex="0"
	onclick={openPicker}
	onkeydown={(event) => {
		if (event.key === "Enter" || event.key === " ") openPicker();
	}}
	ondragenter={(event) => {
		stop(event);
		dragging = true;
	}}
	ondragover={(event) => {
		stop(event);
		dragging = true;
	}}
	ondragleave={(event) => {
		stop(event);
		dragging = false;
	}}
	ondrop={(event) => {
		stop(event);
		dragging = false;
		if (event.dataTransfer?.files.length) handleFiles(event.dataTransfer.files);
	}}
>
	<input
		bind:this={inputRef}
		type="file"
		class="hidden"
		{multiple}
		{accept}
		onchange={(event) => {
			const target = event.currentTarget;
			if (target.files?.length) handleFiles(target.files);
		}}
	/>

	<input
		type="text"
		class="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-0"
		{required}
		value={Array.isArray(value) ? (value.length > 0 ? "valid" : "") : value || ""}
		tabindex="-1"
		aria-hidden="true"
	/>

	{#if name}
		{#if Array.isArray(value)}
			{#each value as url}
				<input type="hidden" {name} value={url} />
			{/each}
		{:else if value}
			<input type="hidden" {name} {value} />
		{/if}
	{/if}

	{#if files.length > 0}
		<div class={cn(!unstyled && (multiple ? "grid w-full grid-cols-2 gap-3 sm:grid-cols-3" : "w-full"))}>
			{#each files as file, index}
				<div class={cn(!unstyled && "relative overflow-hidden rounded-box border border-base-300 bg-base-200/30")} onclick={(event) => event.stopPropagation()} role="presentation">
					{#if isImage(file.type) && file.url}
						<img src={file.url} alt={file.name} class={cn(!unstyled && "h-36 w-full object-cover")} />
					{:else}
						<div class={cn(!unstyled && "flex min-h-36 flex-col items-center justify-center gap-1 p-4 text-base-content/70")}>
							<span class={cn(!unstyled && "max-w-full truncate text-sm font-medium")}>{file.name}</span>
							{#if formatSize(file.size)}<span class={cn(!unstyled && "text-xs text-base-content/50")}>{formatSize(file.size)}</span>{/if}
						</div>
					{/if}

					<button
						type="button"
						class={cn(!unstyled && "absolute right-2 top-2 rounded-full border border-base-300 bg-base-100 px-2 py-0.5 text-xs shadow-sm hover:text-error")}
						onclick={() => remove(index)}
					>
						Remove
					</button>

					{#if file.uploading}
						<div class={cn(!unstyled && "absolute inset-x-2 bottom-2 rounded-full bg-base-100/90 px-2 py-1 text-xs text-base-content/70 shadow-sm")}>Uploading...</div>
					{/if}
				</div>
			{/each}

			{#if multiple && files.length < maxItems}
				<button type="button" class={cn(!unstyled && "min-h-36 rounded-box border border-dashed border-base-300 text-sm text-base-content/60 hover:border-primary/50 hover:bg-base-200/30")} onclick={() => inputRef?.click()}>
					Add file
				</button>
			{/if}
		</div>
	{:else}
		<div class={cn(!unstyled && "pointer-events-none flex flex-col items-center gap-1 text-base-content/60")}>
			<span class={cn(!unstyled && "text-sm")}><span class="font-medium text-primary">Click to upload</span> or drag and drop</span>
			{#if accept}<span class={cn(!unstyled && "max-w-56 truncate text-xs text-base-content/45")}>{accept}</span>{/if}
		</div>
	{/if}
</div>
