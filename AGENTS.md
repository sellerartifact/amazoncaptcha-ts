# AGENTS.md

## Commands

- `pnpm install` - Install dependencies for every workspace package
- `pnpm run build` - Build all packages for production
- `pnpm run dev` - Turn on watch mode for `amazoncaptcha` and rebuild on change
- `pnpm run test` - Run tests in all packages
- `pnpm run typecheck` - Type-check all packages
- `pnpm --filter amazoncaptcha run <script>` - Run a single package's script

## Layout

- `packages/amazoncaptcha` - Rslib library. Entry `src/index.ts`, output `dist/`, tests in `tests/`.
- `tsconfig.base.json` - Shared compiler options; every package `extends` it.
- `pnpm-workspace.yaml` - Workspace globs (`packages/*`).

## Docs

- Rslib: https://rslib.rs/llms.txt
- Rsbuild: https://rsbuild.rs/llms.txt
- Rspack: https://rspack.rs/llms.txt
- Rstest: https://rstest.rs/llms.txt
