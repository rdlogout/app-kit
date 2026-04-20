# @logoutrd/app-kit

Reusable SvelteKit app primitives for backend, frontend, and UI.

This package is scaffolded as a Svelte package using `@sveltejs/package`, with all public library code living under `src/lib` and package output generated into `dist`.

## Development

```sh
pnpm install
pnpm dev
```

## Package

```sh
pnpm package
pnpm check
```

You can inspect the publishable tarball locally with:

```sh
npm pack
```

## Publish

This package is configured as a scoped public npm package.

```sh
npm login
npm publish --access public
```

## Notes

- Public package source lives in `src/lib`
- Built package output lives in `dist`
- `prepublishOnly` runs packaging, publint, and type checks before publish
