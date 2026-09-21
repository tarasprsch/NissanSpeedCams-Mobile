# Repository Guidelines

## Project Structure & Module Organization

The web application lives in `src/`. `App.tsx` coordinates the UI, `components/` contains React components, and `lib/` holds CSV/KML, comparison, loading, and storage logic. Shared types are in `src/types.ts`; fixtures are under `src/test/fixtures/`. Tests are colocated as `*.test.ts` or `*.test.tsx`. The `android/` directory contains the Capacitor project and native `SpeedcamStoragePlugin`; `assets/` contains source artwork. Treat `dist/` as generated.

## Build, Test, and Development Commands

- `npm install` installs the locked dependencies.
- `npm run dev` starts the Vite development server.
- `npm run build` type-checks with TypeScript and creates the production web bundle.
- `npm test` runs the Vitest suite once; `npm run test:watch` reruns affected tests while editing.
- `npm run preview` serves the production bundle locally.
- `npm run android:sync` copies web assets and Capacitor configuration into `android/`; build first when validating web changes.
- `npm run android:open` opens the native project in Android Studio.

## Coding Style & Naming Conventions

Use strict TypeScript and functional React components. Follow local formatting: two-space indentation, semicolons, multiline trailing commas, and explicit boundary types. Name components and types in `PascalCase`, functions and variables in `camelCase`, and hooks with `use`. Keep parsing and storage logic in focused `src/lib/` modules. No formatter or linter is configured; rely on `npm run build` for static checks.

## Testing Guidelines

Tests use Vitest, Testing Library, `jest-dom`, and jsdom. Name tests after observable behavior and mock network or storage boundaries. Add parser cases for malformed or quoted data and component tests for user-visible flows. Run `npm test` and `npm run build` before submitting. No coverage threshold is configured.

## Commit & Pull Request Guidelines

History uses short subjects such as `UI improvements` and `Fixed KML new line texts`. Prefer a concise imperative subject, for example `Fix quoted KML description parsing`. Keep commits focused. Pull requests should explain the change, identify affected web or Android paths, link issues, list verification, and include screenshots for UI changes.

## Security & Configuration

Do not commit keystores, signing credentials, local environment files, dependencies, or generated build output. Review `capacitor.config.ts` and Android manifest changes carefully, and preserve the `com.nissan.speedcams` application ID unless a coordinated migration is intended.
