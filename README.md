# amazoncaptcha-ts

pnpm workspace monorepo. Packages are built with [Rslib](https://rslib.rs) and tested with [Rstest](https://rstest.rs).

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- pnpm 12

## Structure

```
.
├── package.json            # workspace root (private)
├── pnpm-workspace.yaml     # packages/*
├── tsconfig.base.json      # shared compiler options
└── packages/
    └── amazoncaptcha/      # Rslib TypeScript library
        ├── rslib.config.ts
        ├── rstest.config.ts
        ├── src/index.ts    # entry
        ├── tests/
        └── dist/           # build output (git-ignored)
```

## Commands

Run from the repository root:

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `pnpm install`        | Install dependencies for all packages    |
| `pnpm run build`      | Build every package                      |
| `pnpm run dev`        | Watch mode for `amazoncaptcha`           |
| `pnpm run test`       | Run tests in every package               |
| `pnpm run typecheck`  | Type-check every package                 |

Target a single package with `--filter`:

```bash
pnpm --filter amazoncaptcha run build
pnpm --filter amazoncaptcha run test
```

## Adding a package

Create `packages/<name>/`, add its `package.json`, and extend the shared config:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src" },
  "include": ["src"]
}
```

`pnpm-workspace.yaml` already globs `packages/*`, so no registration is needed.
