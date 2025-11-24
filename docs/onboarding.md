# Local Development Notes

## pnpm and Next.js SWC

Some local setups (especially pnpm 10 + npm workspaces) can trigger:

- `npm error code ENOWORKSPACES` during Next’s registry probe
- Missing native SWC error: `Attempted to load @next/swc-darwin-x64, but it was not installed`

### What this repo does

- The root `dev` script now disables npm workspaces probing to avoid the hiccup:
  - `NPM_CONFIG_WORKSPACES=false pnpm -w --filter web dev`
- The web app includes `@next/swc-wasm-nodejs` as a dev dependency so Next can fall back to the WASM build if the native SWC binary isn’t available.

### Recommended local setup (pin pnpm 9)

Pinning pnpm 9 avoids the ENOWORKSPACES issue entirely:

```
corepack enable && corepack prepare pnpm@9.12.2 --activate
rm -rf node_modules apps/web/node_modules apps/web/.next ~/Library/Caches/next-swc
pnpm install
pnpm dev
```

If you prefer to keep pnpm 10, you can still run dev using the root script which sets `NPM_CONFIG_WORKSPACES=false` for you.

### Troubleshooting

- Ensure the WASM fallback is installed: `pnpm -C apps/web ls @next/swc-wasm-nodejs`
- If missing, install explicitly: `pnpm -C apps/web add -D @next/swc-wasm-nodejs@15.5.6`
- Clear caches and retry:
  - `rm -rf apps/web/.next ~/Library/Caches/next-swc`
  - `pnpm dev`
