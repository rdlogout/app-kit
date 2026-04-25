# UI Usage

`@logoutrd/app-kit/ui` exposes Svelte 5 components backed by Tailwind CSS v4 and daisyUI v5.

The consuming app owns Tailwind, daisyUI, CSS, and theme configuration. App-kit only ships Svelte components and class names.

## Install

For a published package:

```sh
pnpm add @logoutrd/app-kit
pnpm add -D tailwindcss @tailwindcss/vite daisyui
```

For local workspace development:

```yaml
# pnpm-workspace.yaml
packages:
  - "app"
  - "../app-kit"
```

```json
{
	"dependencies": {
		"@logoutrd/app-kit": "workspace:*"
	}
}
```

If the workspace package is consumed from `dist`, rebuild app-kit after UI changes:

```sh
pnpm --dir ../app-kit package
```

## Vite Setup

Add Tailwind's Vite plugin in the consuming app:

```ts
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
});
```

## CSS Setup

In the consuming app's main CSS file, import Tailwind, register app-kit as a Tailwind source, and enable daisyUI.

For npm/published package usage:

```css
@import "tailwindcss";
@source "../node_modules/@logoutrd/app-kit/dist";

@plugin "daisyui";
```

The `@source` line is required in Tailwind v4 because dependencies and `node_modules` are not scanned by default. Without it, app-kit component classes can be missing from generated CSS.

For pnpm workspace usage where the app links to `../app-kit`, use the same `dist` source after running `pnpm --dir ../app-kit package`:

```css
@import "tailwindcss";
@source "../node_modules/@logoutrd/app-kit/dist";

@plugin "daisyui";
```

If you want Tailwind to scan app-kit source directly during local development, add the source path too. From `fussion.studio/app/src/app.css`, that path is:

```css
@source "../../../app-kit/src/lib/ui";
```

Keep the `node_modules` source as the normal published-package path and use the source path only as a local development helper.

## daisyUI Include List

If you use unrestricted daisyUI, this is enough:

```css
@plugin "daisyui" {
	themes:
		light --default,
		dark --prefersdark;
}
```

If you use daisyUI's `include` option, make sure every app-kit component class family is included:

```css
@plugin "daisyui" {
	themes:
		light --default,
		dark --prefersdark;
	include:
		[ "button",
		"loading",
		"card",
		"input",
		"textarea",
		"select",
		"checkbox",
		"fieldset",
		"label",
		"validator",
		"dropdown",
		"tooltip",
		"progress",
		"avatar",
		"join" ];
}
```

Add app-local daisyUI components to the list as needed, for example `radio`, `toggle`, `range`, `table`, or `breadcrumbs`.

## fussion.studio Example

`fussion.studio/app` already has `@logoutrd/app-kit` as a workspace dependency and already uses Tailwind v4 and daisyUI.

Add this near the top of `src/app.css`:

```css
@import "tailwindcss";
@source "../node_modules/@logoutrd/app-kit/dist";
@source "../../../app-kit/src/lib/ui"; /* optional local workspace helper */
```

Then make sure the daisyUI `include` list contains at least:

```css
include:
	[ "button",
	"loading",
	"card",
	"input",
	"textarea",
	"select",
	"checkbox",
	"fieldset",
	"label",
	"validator",
	"dropdown",
	"tooltip",
	"progress",
	"avatar",
	"join" ];
```

## Imports

Use the UI barrel for convenience:

```svelte
<script lang="ts">
	import { Button, Card, Input } from "@logoutrd/app-kit/ui";
</script>
```

Use subpaths when importing one component:

```svelte
<script lang="ts">
	import Button from "@logoutrd/app-kit/ui/button";
</script>
```

## Button

```svelte
<script lang="ts">
	import Button from "@logoutrd/app-kit/ui/button";
</script>

<Button variant="primary">Save</Button>
<Button variant="ghost" loading>Saving</Button>
<Button variant="outline" href="/billing">Billing</Button>
```

## Form Fields

```svelte
<script lang="ts">
	import { Form, Input, Select, Textarea, Checkbox, Button } from "@logoutrd/app-kit/ui";

	let email = $state("");
	let role = $state("user");
	let notes = $state("");
	let accepted = $state(false);

	const roles = [
		{ label: "User", value: "user" },
		{ label: "Admin", value: "admin" },
	];
</script>

<Form onSubmit={() => console.log({ email, role, notes, accepted })}>
	<Input
		label="Email"
		type="email"
		bind:value={email}
		required
		validatorHint="Enter a valid email address"
	/>

	<Select label="Role" bind:value={role} options={roles} />

	<Textarea label="Notes" bind:value={notes} />

	<Checkbox label="Accept terms" bind:value={accepted} required validatorHint="Required" />

	<Button type="submit" variant="primary">Submit</Button>
</Form>
```

## Prefix And Suffix

`Input`, `Select`, and `Textarea` support `prefix` and `suffix`. These can be strings or snippets.

```svelte
<Input label="Amount" prefix="$" suffix="USD" bind:value={amount} />
```

With an icon:

```svelte
<script lang="ts">
	import Input from "@logoutrd/app-kit/ui/input";
	import IconSearch from "~icons/lucide/search";
</script>

<Input type="search" placeholder="Search">
	{#snippet prefix()}
		<IconSearch />
	{/snippet}
</Input>
```

## OTP Input

`OtpInput` follows the same field API as other form inputs: `label`, `hint`, `error`, `validatorHint`, `class`, `inputClass`, and bindable `value`.

```svelte
<script lang="ts">
	import OtpInput from "@logoutrd/app-kit/ui/otp-input";

	let code = $state("");
</script>

<OtpInput
	label="Verification code"
	bind:value={code}
	length={6}
	autoFocus
	required
	validatorHint="Enter the 6 digit code"
/>
```

It supports numeric input, one-time-code autofill, full-code paste, auto advance, and backspace navigation.

## Tabs

App-kit tabs use `title`, not `label`:

```svelte
<script lang="ts">
	import Tabs from "@logoutrd/app-kit/ui/tabs";
</script>

<Tabs defaultActiveIndex={0}>
	<Tabs.Item title="Usage" id="usage">Usage content</Tabs.Item>
	<Tabs.Item title="Top-ups" id="topups">Top-up content</Tabs.Item>
</Tabs>
```

When migrating existing app components, change `label="..."` to `title="..."`.

## Troubleshooting

If a component renders without styling:

1. Confirm the app imports Tailwind in its main CSS file: `@import "tailwindcss";`
2. Confirm the app has `@plugin "daisyui";` or a configured daisyUI plugin block.
3. Confirm Tailwind scans app-kit with `@source "../node_modules/@logoutrd/app-kit/dist";`.
4. If using a daisyUI `include` list, confirm the needed component family is included.
5. If using `workspace:*`, run `pnpm --dir ../app-kit package` after changing app-kit.

If imports fail:

1. Confirm `@logoutrd/app-kit` is installed or linked in the consuming app.
2. Confirm app-kit has been packaged and `dist/ui/index.js` exists.
3. Prefer public imports like `@logoutrd/app-kit/ui` or `@logoutrd/app-kit/ui/button`; do not import from `src/lib`.
