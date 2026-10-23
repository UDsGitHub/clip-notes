# Chrome Web Store listing

Everything the developer dashboard asks for, ready to paste. `tests/storeListing.test.ts` keeps
this file in step with the manifest, and the images are made by `npm run store-assets`.

## Store listing tab

**Name** (from the manifest): Clip Notes

**Summary** (the manifest's `description`, at most 132 characters):

> Take notes in Chrome's side panel and clip text from any page with a right-click. Private: your notes never leave your device.

**Category:** Workflow & Planning

**Language:** English

**Description:**

```text
Clip Notes is a simple, fast notebook that lives in Chrome's side panel, right beside the page you're reading. No account, no sign-up, and nothing ever leaves your device.

CLIP TEXT FROM ANY PAGE
Select text on a web page, right-click and choose "Save to Notes". The side panel opens with your clip saved as a note, titled after the page and linked back to it, so you can always find where it came from.

WRITE AND ORGANIZE
• Write notes with a title, text and tags.
• Pin important notes so they stay on top.
• Drag notes into your own order, with the mouse or the keyboard.
• Edit any note in place, and click a note to copy its text.
• Deleted something by mistake? Undo brings it right back.

FIND ANYTHING IN SECONDS
Search titles, notes and tags as you type, or tap a tag to see only those notes.

PRIVATE BY DESIGN
• Your notes are stored in your browser, on your device.
• No account, no servers, no analytics, no network requests at all.
• Clip Notes only sees the text you choose to save.

YOUR NOTES, YOURS TO KEEP
Export everything as JSON or CSV at any time, and import it again on another computer.

Works in light and dark themes, follows Chrome's own setting, and is usable by keyboard and with screen readers.
```

**Screenshots** (1280×800, `docs/store/screenshots/`), in this order:

1. `1-notes.png`: your notes, right beside every page
2. `2-clip.png`: clip text from any page with a right-click
3. `3-search.png`: find any note by search or tag
4. `4-edit.png`: pin, tag, reorder and edit
5. `5-private.png`: private, and yours to keep (light theme, export)

**Store icon** (128×128 PNG): `docs/store/icon-128.png`, a copy of the extension's own
`public/icon/128.png`.

**Small promo tile** (440×280): `docs/store/promo-tile.png`

**Official URL:** none. **Homepage URL:** https://github.com/UDsGitHub/chrome-notes-extension

**Support URL:** https://github.com/UDsGitHub/chrome-notes-extension/issues

## Privacy practices tab

**Single purpose:**

> Clip Notes is a notebook in Chrome's side panel: write, organize and search notes, and save text selected on a web page as a note, all stored on the user's device.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `sidePanel` | Clip Notes' whole interface is in the side panel, so notes can be written and read beside the current page. |
| `storage` | Saves the user's notes locally in chrome.storage.local. Nothing is synced or sent. |
| `contextMenus` | Adds "Save to Notes" to the right-click menu on selected text, to save that text as a note. |

**Remote code:** No, I am not using remote code. All code is in the package.

**Data usage:** none of the data types is collected. Clip Notes stores the user's notes (and the
text they choose to clip) only on their device and transmits nothing. Tick all three
certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://udsgithub.github.io/chrome-notes-extension/privacy/ (GitHub
Pages, from `docs/privacy/index.html`).

## Package tab

Upload `.output/clip-notes-1.1.0-chrome.zip` from `npm run zip`.

**What's new in 1.1.0** (for your own notes; the store doesn't show release notes):

> Rebuilt for reliability. Save to Notes now always opens the panel, and clips are titled after their page with a link back. Undo after deleting a note. Notes stay in sync across windows. Reorder by keyboard, better accessibility, and one fewer permission.

## Account tab

**Contact email:** dingding8003@gmail.com (must be verified in the dashboard).
