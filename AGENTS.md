# Repository Guidelines

## Project Structure & Module Organization
LobeChat runs the production web app straight from `src` with Next.js 15 and React 19. Feature modules live under `src/features`, shared UI elements in `src/components`, and server handlers in `src/app/(api|server)` folders. Desktop-specific code sits in `apps/desktop`. Shared utilities and UI kits are published from `packages/*`. Integration and regression tests live in `tests` with mocks in `__mocks__`. Reference `.cursor/rules/` for architecture, state, and schema playbooks before introducing new patterns.

## Build, Test, and Development Commands
- `pnpm dev --hostname 0.0.0.0 -p 3010` – serve the Next.js app for LAN access on port 3010.
- `bun run dev` – start the web app locally with Turbopack on http://localhost:3010.
- `bun run dev:desktop` – launch the Electron preview alongside the Next app.
- `bun run build` – create the production bundle; runs linting via `prebuild`.
- `bun run db:migrate` – apply Drizzle migrations (requires database env vars).
- `bunx vitest run --silent='passed-only' 'tests/suite.spec.ts'` – run targeted unit suites.
- `bun run type-check` – execute strict TypeScript validation.

**Note**: Prefer `pnpm dev --hostname 0.0.0.0 -p 3010` for local development; verified it starts successfully even when the Bun runtime is absent.

## Coding Style & Naming Conventions
Use TypeScript everywhere with 2-space indentation, camelCase variables, PascalCase components, and kebab-case folders. Prefer `interface` for object contracts and lean on generics for reusable hooks. Keep React components functional, colocate styles with modules, and follow Ant Design + @lobehub/ui patterns. Drizzle tables use plural snake_case names with explicit foreign keys. Run `bun run lint` (ESLint, Stylelint, Prettier, circular deps) before submitting.

## Testing Guidelines
Vitest with Testing Library drives unit and integration coverage; Happy DOM is available for component suites. Mirror production file names with `.spec.ts` or `.test.tsx` suffixes under `tests/` or alongside features when scoped. Always add or update tests when touching logic. Wrap file globs in single quotes to avoid shell expansion, and if a test fails twice, pause and request help.

## Commit & Pull Request Guidelines
Prefix commits with a gitmoji (e.g., `:sparkles: feat: add agent tab`). Branches follow `username/feat/short-slug`. Rebase before pushing, and keep commits focused. Pull requests must use `.github/PULL_REQUEST_TEMPLATE.md`, link relevant issues, include screenshots or logs for UI or behavior changes, and confirm lint, type-check, and targeted tests in the checklist before requesting review.
