# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Clip Notes (published on the Chrome Web Store since 1.0.0; repo `UDsGitHub/chrome-notes-extension`) is a Manifest V3 Chrome extension: a notes app in the side panel, with "Save to Notes" on selected page text. Built with WXT + React 18 + TypeScript (strict) + Tailwind v4, the same stack as Huntlog. 1.1 rewrote the 1.0 vanilla-TS version with the same features and look.

## Commands

- `npm run dev`: WXT dev mode (launches Chrome with hot reload).
- `npm run build`: production build to `.output/chrome-mv3/`. `npm run zip`: store upload zip.
- `npx vitest run`: unit and component tests (`lib/`, `components/`, `tests/`). One file: `npx vitest run lib/notes.test.ts`.
- `npx playwright test`: end-to-end tests in `e2e/` on the built extension (`npm run build` first). `e2e/a11y.spec.ts` runs axe on every screen at 320px in light and dark; `e2e/manifest.spec.ts` pins the permissions.
- `npm run lint` / `npx tsc --noEmit` / `npx prettier --check .`. ESLint bans network APIs.

Gotchas:
- Every file in `entrypoints/` is an entrypoint, so their tests go in `tests/`.
- Use WXT's `browser` global, not `chrome`. In Playwright `serviceWorker.evaluate` the global is `chrome`; declare it as `typeof browser`.
- Playwright can't click native context menus; e2e writes clips to storage the way `saveClip` does, and `tests/background.test.ts` covers the menu handler.
- happy-dom lacks the Popover API; `vitest.setup.ts` stubs it.
- TypeScript is pinned to `~6.0` because typescript-eslint doesn't support TS 7 yet.

## Architecture

**Storage never changes shape.** Notes live in `chrome.storage.local` under `notes` as `{ [id]: note }`, exactly as 1.0 stored them, so updates need no migration. Never rename the key. `lib/notes.ts` is the only module that reads or writes it: `normalizeStoredNotes` accepts every layout 1.0 wrote (missing `order`/`pinned`/`tags`, `updatedAt: null`; notes with no `order` are numbered by recency, as 1.0 did). New optional fields (like `url`) must stay optional.

**Writes are serialized across contexts.** Every write is read-modify-write of the whole map inside `withNotesLock` (`lib/lock.ts`, Web Locks: shared by all panels and the service worker). Don't write `notes` any other way.

**The panel is a view of storage.** `useNotes` reads once and then follows `storage.local.onChanged`, so writes from this panel, another window's panel, and clips from the service worker all arrive the same way. Only drag-and-drop updates state optimistically (`applyMove`).

**Clipping:** `entrypoints/background.ts` calls `sidePanel.open()` synchronously inside the menu click, before any `await` (Chrome rejects it once the gesture is gone; 1.0 awaited first), then `saveClip` writes the note straight to storage, titled after the page, with its http(s) URL.

**Order:** higher `order` = nearer the top of its section (pinned or not). New and newly pinned notes take max + 1. `moveNote` renumbers one section from storage's current order. Imports go above existing notes in the file's order.

**Import/export:** `lib/importNotes.ts` reads JSON arrays and CSV with any known columns in any order (every past export format). User-facing error messages come from the thrown `Error`s. Exports download through a link (`lib/download.ts`): no `downloads` permission.

**Permissions are minimal:** `sidePanel`, `contextMenus`, `storage`. Adding one prompts every existing user; it's a product decision. No network calls, remote code or host permissions.

**Style:** the 1.0 palette is kept as CSS variables in `entrypoints/sidepanel/style.css` (light-dark(), so the browser's scheme picks), exposed as Tailwind colors (`bg-surface`, `text-secondary`, `border-accent`, …). The few deliberate changes were for WCAG AA contrast, which `e2e/a11y.spec.ts` enforces.
