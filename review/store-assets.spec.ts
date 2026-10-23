import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  animationsSettled,
  card,
  expect,
  openPanel,
  seedNotes,
  test,
  type ExtensionSession,
} from '../e2e/fixtures';

// Chrome Web Store images (docs/store/listing.md): five 1280×800 screenshots and the 440×280
// promo tile, made from the real production build with sample notes. Each screenshot is the side
// panel as captured, set beside a caption. `npm run build && npm run store-assets`.

declare const chrome: typeof browser;

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/store');
const WORK = path.join(ROOT, 'test-results/store-assets');
const PANEL = { width: 400, height: 720 };
const LOGO = pathToFileURL(path.join(ROOT, 'assets/logo.png')).href;

const note = (
  title: string,
  content: string,
  createdAt: string,
  order: number,
  extra: Record<string, unknown> = {},
) => ({ title, content, createdAt, order, pinned: false, tags: [], ...extra });

// A plausible notebook. Sites are example domains: the listing must not show real brands.
const NOTES = {
  'note-trip': note(
    'Trip checklist',
    'Passport, charger, travel adapter, boarding pass on phone. Check in 24 hours before the flight.',
    '2026-10-18T14:10:00.000Z',
    1,
    { pinned: true, tags: ['travel'] },
  ),
  'note-week': note(
    'Weekly planning',
    'Review goals, clear the inbox, and pick the top three tasks for the week.',
    '2026-10-19T08:30:00.000Z',
    6,
    { tags: ['work', 'planning'] },
  ),
  'note-roadmap': note(
    'Q4 roadmap meeting',
    'Ship search filters first. Dark mode polish next sprint. Follow up with design about onboarding.',
    '2026-10-21T15:30:00.000Z',
    5,
    { tags: ['work'] },
  ),
  'note-pasta': note(
    'Pasta night',
    'Garlic, olive oil, chili flakes, spaghetti. Finish with parsley and parmesan.',
    '2026-10-17T18:45:00.000Z',
    4,
    { tags: ['recipes', 'personal'] },
  ),
  'note-reading': note(
    'Reading list',
    'Deep Work · The Design of Everyday Things · Staff Engineer · A Philosophy of Software Design',
    '2026-10-12T19:00:00.000Z',
    3,
    { tags: ['personal', 'learning'] },
  ),
  'note-spanish': note(
    'Spanish phrases',
    '¿Dónde está la estación? · Una mesa para dos, por favor · ¿Cuánto cuesta?',
    '2026-10-10T07:30:00.000Z',
    2,
    { tags: ['learning', 'travel'] },
  ),
  'note-gifts': note(
    'Gift ideas',
    'Mom: pottery class. Sam: the hiking guide he mentioned. Alex: noise-cancelling earbuds.',
    '2026-10-08T12:00:00.000Z',
    1,
    { tags: ['personal'] },
  ),
};

const CLIP = {
  'note-clip': note(
    'How short breaks boost focus',
    'Work in focused 25-minute intervals separated by short breaks. After four intervals, take a longer break of 15 to 30 minutes.',
    '2026-10-23T10:05:00.000Z',
    7,
    { url: 'https://blog.example.com/focus/short-breaks' },
  ),
};

/** The panel as it is now, at its real size, for the composite. */
async function panelShot(page: Page, name: string, { blur = true } = {}) {
  if (blur) await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await animationsSettled(page);
  const file = path.join(WORK, `${name}-panel.png`);
  await page.screenshot({ path: file });
  return file;
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
`;

/** A 1280×800 screenshot: a caption on the left, the panel docked on the right. */
async function compose(
  session: ExtensionSession,
  name: string,
  panel: string,
  caption: { title: string; text: string },
  aside = '',
) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    ${BASE_CSS}
    body { width: 1280px; height: 800px; overflow: hidden; color: #111;
      background: linear-gradient(135deg, #fff8e6 0%, #fafafa 55%, #e9eefb 100%);
      display: flex; align-items: center; }
    .copy { flex: 1; padding: 0 72px 0 88px; display: flex; flex-direction: column; gap: 22px; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 650; font-size: 22px; }
    .brand img { width: 40px; height: 40px; }
    h1 { margin: 0; font-size: 48px; line-height: 1.1; letter-spacing: -0.02em; font-weight: 700; text-wrap: balance; }
    p { margin: 0; font-size: 22px; line-height: 1.45; color: #444; max-width: 560px; text-wrap: pretty; }
    .panel { width: ${PANEL.width}px; height: ${PANEL.height}px; margin-right: 72px; border-radius: 14px;
      overflow: hidden; box-shadow: 0 24px 60px rgba(17, 17, 17, .22), 0 0 0 1px rgba(17, 17, 17, .1);
      background: #111; }
    .panel img { display: block; width: 100%; height: 100%; }
  </style></head><body>
    <div class="copy">
      <div class="brand"><img src="${LOGO}" alt=""><span>Clip Notes</span></div>
      <h1>${caption.title}</h1>
      <p>${caption.text}</p>
      ${aside}
    </div>
    <div class="panel"><img src="${pathToFileURL(panel).href}"></div>
  </body></html>`;
  await render(session, html, { width: 1280, height: 800 }, `screenshots/${name}.png`);
}

/** Renders a page of HTML at `size` into docs/store/`out`, once its images have loaded. */
async function render(
  session: ExtensionSession,
  html: string,
  size: { width: number; height: number },
  out: string,
) {
  const file = path.join(WORK, `${path.basename(out, '.png')}.html`);
  fs.writeFileSync(file, html);
  const page = await session.context.newPage();
  await page.setViewportSize(size);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, out) });
  await page.close();
}

// A page with selected text and Chrome's right-click menu, drawn (Playwright can't open the
// real menu).
const CLIP_ASIDE = `<div style="position: relative; margin: 10px 0 170px; max-width: 520px; padding: 22px 24px 26px;
  border-radius: 12px; background: #fff; box-shadow: 0 10px 30px rgba(17,17,17,.10), 0 0 0 1px rgba(17,17,17,.06);
  font-size: 17px; line-height: 1.55; color: #333;">
  <div style="font-weight: 650; font-size: 19px; color: #111; margin-bottom: 8px;">How short breaks boost focus</div>
  <span>The method is simple. </span><span style="background: #b4d5fe; color: #111;">Work in focused
  25-minute intervals separated by short breaks. After four intervals, take a longer break of 15
  to 30 minutes.</span>
  <div style="position: absolute; left: 250px; top: calc(100% - 18px); width: 230px; border-radius: 8px; background: #fff;
    box-shadow: 0 8px 24px rgba(17,17,17,.18), 0 0 0 1px rgba(17,17,17,.08); padding: 6px 0;
    font-size: 15px; color: #27272a;">
    <div style="padding: 7px 16px;">Copy</div>
    <div style="padding: 7px 16px;">Search the web</div>
    <div style="height: 1px; background: #e5e5e5; margin: 6px 0;"></div>
    <div style="padding: 7px 16px; background: #fff3cc; display: flex; align-items: center; gap: 10px; font-weight: 550;">
      <img src="${LOGO}" alt="" style="width: 16px; height: 16px;"> Save to Notes</div>
    <div style="padding: 7px 16px;">Inspect</div>
  </div>
</div>`;

test('store screenshots and promo tile', async ({ session }) => {
  fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });
  fs.mkdirSync(WORK, { recursive: true });
  await seedNotes(session, NOTES);

  // 1. The notebook.
  const page = await openPanel(session, { ...PANEL, colorScheme: 'dark' });
  await page.setViewportSize(PANEL);
  await compose(session, '1-notes', await panelShot(page, 'notes'), {
    title: 'Your notes, right beside every page',
    text: 'Clip Notes lives in Chrome’s side panel. Write a note, pin what matters, and tag it to find it later.',
  });

  // 2. A clip arrives: the selected text, titled after its page, with a link back.
  await session.serviceWorker.evaluate(
    (clip) =>
      chrome.storage.local
        .get('notes')
        .then(({ notes }) =>
          chrome.storage.local.set({ notes: { ...(notes as object), ...clip } }),
        ),
    CLIP,
  );
  const clipped = card(page, 'How short breaks boost focus');
  await expect(clipped).toBeVisible();
  await page.locator('[data-scroll-area]').evaluate((area, id) => {
    const target = area.querySelector<HTMLElement>(`[data-note-id="${id}"]`)!;
    area.scrollTo(0, target.offsetTop - 12);
  }, 'note-clip');
  await compose(
    session,
    '2-clip',
    await panelShot(page, 'clip'),
    {
      title: 'Clip text from any page',
      text: 'Select text, right-click and choose Save to Notes. It’s saved with the page’s title and a link back to it.',
    },
    CLIP_ASIDE,
  );

  // 3. Search within a tag.
  await page.getByRole('button', { name: 'learning', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('design');
  await expect(page.locator('[data-note-id]')).toHaveCount(1);
  await compose(session, '3-search', await panelShot(page, 'search', { blur: false }), {
    title: 'Find any note in seconds',
    text: 'Search titles, notes and tags as you type, or tap a tag to see only those notes.',
  });
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('');
  await page.getByRole('button', { name: 'All', exact: true }).click();

  // 4. Editing in place.
  await card(page, 'Trip checklist').getByRole('button', { name: 'Edit Trip checklist' }).click();
  await page
    .getByRole('textbox', { name: 'Note' })
    .fill(
      'Passport, charger, travel adapter, boarding pass on phone. Check in 24 hours before the flight. Book the airport taxi.',
    );
  await page.locator('[data-scroll-area]').evaluate((element) => element.scrollTo(0, 0));
  await compose(session, '4-edit', await panelShot(page, 'edit', { blur: false }), {
    title: 'Pin, tag, reorder and edit',
    text: 'Keep important notes pinned on top, drag notes into your own order, and click any note to copy it.',
  });
  await page.keyboard.press('Escape');

  // 5. Private, and yours to keep: light theme, with the export menu open.
  const light = await openPanel(session, { ...PANEL, colorScheme: 'light' });
  await light.setViewportSize(PANEL);
  await light.getByRole('button', { name: 'Export notes' }).click();
  await expect(light.getByRole('button', { name: 'Export as JSON' })).toBeVisible();
  await compose(session, '5-private', await panelShot(light, 'private'), {
    title: 'Private, and yours to keep',
    text: 'No account, no servers, no tracking: your notes never leave your device. Export them as JSON or CSV any time. Light and dark themes.',
  });

  // The small promo tile, 440×280.
  await render(
    session,
    `<!doctype html><html><head><meta charset="utf-8"><style>
      ${BASE_CSS}
      body { width: 440px; height: 280px; overflow: hidden; color: #fafafa;
        background: radial-gradient(120% 120% at 0% 0%, #2a2a2a 0%, #171717 55%, #111 100%);
        display: flex; flex-direction: column; justify-content: center; padding: 0 40px; gap: 16px; }
      .brand { display: flex; align-items: center; gap: 16px; font-size: 40px; font-weight: 700; letter-spacing: -0.02em; }
      .brand img { width: 68px; height: 68px; filter: drop-shadow(0 6px 14px rgba(0,0,0,.45)); }
      p { margin: 0; font-size: 20px; line-height: 1.35; color: #d4d4d4; }
      p strong { color: #ffd166; font-weight: 600; }
    </style></head><body>
      <div class="brand"><img src="${LOGO}" alt=""><span>Clip Notes</span></div>
      <p>Notes in Chrome’s side panel. Clip text from any page. <strong>Private: nothing leaves your device.</strong></p>
    </body></html>`,
    { width: 440, height: 280 },
    'promo-tile.png',
  );
});
