# Clip Notes

Take simple notes in your browser.

Clip Notes is a Manifest V3 Chrome extension that opens in the side panel. Notes stay on-device in `chrome.storage.local`, with pin, tags, search, drag-to-reorder, and JSON/CSV import & export.

## Features

- Side panel notebook (opens from the toolbar action)
- Create, edit, delete notes with a title, body and tags; deleting offers **Undo**
- Pin notes to a dedicated section (reorder within pinned / unpinned)
- Tags plus a single-select tag filter chip bar and debounced search
- Drag-and-drop reorder, by mouse or keyboard (disabled while a filter is active)
- Click a note to copy its text
- Import / export as JSON or CSV
- Right-click **Save to Notes** on selected page text: the note is titled after the page and links back to it
- Open panels in other windows stay in sync
- Light / dark via `color-scheme`

## Development setup

Requirements: Node.js 20+ (CI uses 24), and Google Chrome or Chromium 123+.

Built with [WXT](https://wxt.dev), React 18, TypeScript and Tailwind CSS v4.

```bash
npm install
npm run dev     # launches Chrome with the extension and hot reload
npm run build   # production build in .output/chrome-mv3/
```

### Load the production build in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select `.output/chrome-mv3`.
4. Open the extension from the toolbar; it uses the side panel.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | WXT dev mode with hot reload |
| `npm run build` | Production build to `.output/chrome-mv3/` |
| `npm run zip` | Chrome Web Store upload zip in `.output/` |
| `npm run typecheck` | Type check |
| `npm run lint` | ESLint (also bans network APIs) |
| `npm run format` | Prettier |
| `npm test` | Vitest unit and component tests |
| `npm run store-assets` | Chrome Web Store screenshots and promo tile into `docs/store/` (build first) |
| `npm run e2e` | Playwright end-to-end and accessibility tests on the built extension (run `npm run build` and `npx playwright install chromium` first) |

## Permissions

| Permission | Why |
| --- | --- |
| `sidePanel` | Host the notes UI in Chrome’s side panel |
| `storage` | Persist notes locally in `chrome.storage.local` |
| `contextMenus` | “Save to Notes” on selected text |

Exports save through a regular download link, so the extension doesn’t need the `downloads` permission (1.0 did).

## Privacy

Notes never leave your device: there are no servers, analytics or network requests, and ESLint fails the build on network APIs.

## Import / export

Export produces notes in display order. Import **skips** ids that already exist and places imported notes above your existing ones, keeping their order.

### JSON

Array of note objects. Required: `id`, `title`, `content`, `createdAt`. Optional: `updatedAt`, `order`, `pinned` (default `false`), `tags` (default `[]`), `url` (http or https).

See [`examples/sample-notes.json`](examples/sample-notes.json).

### CSV

Header (current):

```text
id,title,content,createdAt,updatedAt,order,pinned,tags,url
```

- `tags` uses `;` between values (commas stay available inside CSV fields)
- Columns can come in any order; only `id,title,content,createdAt` are required, so exports from every earlier version still import

See [`examples/sample-notes.csv`](examples/sample-notes.csv).

### Try the sample data

1. Optionally export and back up your real notes first.
2. In Clip Notes, open **Import**.
3. Choose the JSON or CSV file under `examples/`.
4. Confirm the pinned notes, tag chips, and search/filter behavior.

To re-import the same samples after testing, delete those notes (or clear extension storage) first — duplicate ids are skipped.

## Project layout

```text
wxt.config.ts          Manifest settings (name, permissions, minimum Chrome)
entrypoints/           background.ts (service worker) and sidepanel/ (the React app)
components/            UI components
lib/                   Storage, import/export, filtering: plain TypeScript with unit tests
tests/                 Tests for entrypoints (background, the whole panel)
e2e/                   Playwright tests against the production build
public/icon/           Extension icons (from assets/logo.png)
examples/              Sample import files for demos and screenshots
reference/             Product screenshots for docs and store listing
```

## Screenshots

Assets live in [`reference/`](reference/). Populate the UI with [`examples/sample-notes.json`](examples/sample-notes.json) before capturing.

### Gallery

![Clip Notes overview](reference/screenshot_0_base.png)

*Overview — pinned notes, tag chips, and search*

![Import dialog](reference/screenshot_1_import_dialog.png)

*Import notes from JSON or CSV*

![Export menu](reference/screenshot_2_export_dialog.png)

*Export as JSON or CSV*

![Search filter](reference/screenshot_3_search_filter.png)

*Debounced search across title, body, and tags*

![Tag chip filter](reference/screenshot_4_chip_filter.png)

*Single-select tag filter chips*

![Edit note](reference/screenshot_5_edit_note.png)

*Edit title, body, and tags*

![Delete all confirmation](reference/screenshot_6_delete_all.png)

*Delete all notes (with confirmation)*

![Import success](reference/screenshot_7_import_success.png)

*Successful import*

![Import warning](reference/screenshot_8_import_warning.png)

*Import skipped existing ids*

![Import validation](reference/screenshot_9_import_validation.png)

*Import validation error*

![Save to Notes context menu](reference/screenshot_10_context_menu.png)

*Right-click selected text → Save to Notes*

### Chrome Web Store

The store's five 1280×800 screenshots and its 440×280 promo tile live in [`docs/store/`](docs/store/), made from the production build with sample notes:

```bash
npm run build && npm run store-assets
```

[`docs/store/listing.md`](docs/store/listing.md) has the listing text, permission justifications and privacy answers, ready to paste into the developer dashboard. The privacy policy is [`docs/privacy/index.html`](docs/privacy/index.html), published with GitHub Pages at https://udsgithub.github.io/chrome-notes-extension/privacy/.

## Author & license

- **Author:** Udochukwu Amaefule ([GitHub](https://github.com/UDsGitHub))
- **License:** [MIT](LICENSE)

MIT is a short permissive open-source license: others can use, modify, and redistribute the code (including in commercial products) as long as they keep the copyright notice. That is separate from Chrome Web Store distribution—you can still publish the extension on the marketplace while keeping the source MIT-licensed. A “commercial license” is only needed if you want to *sell or restrict* rights to the source itself; most indie extensions use MIT (or similar) for the repo.
