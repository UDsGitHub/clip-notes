import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const EXTENSION_PATH = path.resolve(import.meta.dirname, '../.output/chrome-mv3');

export interface ExtensionSession {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

/** Launches Chromium with the unpacked build. Reusing `userDataDir` simulates a browser restart. */
export async function launchExtension(userDataDir: string): Promise<ExtensionSession> {
  if (!fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) {
    throw new Error(`No build at ${EXTENSION_PATH}. Run \`npm run build\` first.`);
  }
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    // Tests assert en-US date formats; don't depend on the machine's language.
    locale: 'en-US',
    // Dates render the same on every machine (and in the store screenshots).
    timezoneId: 'UTC',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      // Lets tests click the toolbar icon through CDP (Extensions.triggerAction), test-only.
      '--enable-unsafe-extension-debugging',
      '--remote-debugging-port=0',
    ],
  });
  const serviceWorker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(serviceWorker.url()).host;
  return { context, serviceWorker, extensionId };
}

/**
 * Clicks the extension's toolbar icon on the tab showing `tabUrl`, like a real user gesture.
 * Playwright can't click the toolbar or native context menus, and its key presses never reach
 * Chrome's extension shortcuts, so this is the only real gesture available to tests.
 */
export async function clickToolbarIcon(userDataDir: string, extensionId: string, tabUrl: string) {
  const [port, wsPath] = fs
    .readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8')
    .trim()
    .split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  // One listener settles calls by id; closing the socket rejects anything still pending.
  const pending = new Map<
    number,
    { method: string; resolve: (r: unknown) => void; reject: (e: Error) => void }
  >();
  ws.addEventListener('message', (event) => {
    const reply = JSON.parse(String(event.data));
    const call = pending.get(reply.id);
    if (!call) return;
    pending.delete(reply.id);
    if (reply.error) call.reject(new Error(`${call.method}: ${reply.error.message}`));
    else call.resolve(reply.result);
  });
  ws.addEventListener('close', () => {
    for (const call of pending.values())
      call.reject(new Error(`${call.method}: CDP socket closed`));
    pending.clear();
  });
  let nextId = 0;
  const call = <T>(method: string, params: object) =>
    new Promise<T>((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { method, resolve: resolve as (r: unknown) => void, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  try {
    const { targetInfos } = await call<{ targetInfos: { targetId: string; url: string }[] }>(
      'Target.getTargets',
      { filter: [{ type: 'tab' }] },
    );
    const tab = targetInfos.find((t) => t.url === tabUrl);
    if (!tab) throw new Error(`No tab at ${tabUrl}`);
    await call('Extensions.triggerAction', { id: extensionId, targetId: tab.targetId });
  } finally {
    ws.close();
  }
}

export const test = base.extend<{ userDataDir: string; session: ExtensionSession }>({
  // eslint-disable-next-line no-empty-pattern
  userDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clip-notes-e2e-'));
    await use(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  },
  session: async ({ userDataDir }, use) => {
    const session = await launchExtension(userDataDir);
    await use(session);
    await session.context.close();
  },
});

export const expect = test.expect;

export const panelUrl = (extensionId: string) => `chrome-extension://${extensionId}/sidepanel.html`;

/**
 * Waits until nothing visible is moving or fading, including animations that start meanwhile
 * (a slide a click just started; a color measured mid-fade is too faint). Capped at 2 s, and
 * animations in hidden sections are ignored: content-visibility stops them, so they never end.
 */
export async function animationsSettled(page: Page) {
  await page.waitForTimeout(100);
  await page.evaluate(async () => {
    const deadline = performance.now() + 2000;
    while (performance.now() < deadline) {
      const moving = document.getAnimations().filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return (
          animation.playState === 'running' && target instanceof Element && target.checkVisibility()
        );
      });
      if (moving.length === 0) return;
      await Promise.race([
        Promise.allSettled(moving.map((animation) => animation.finished)),
        new Promise((resolve) => setTimeout(resolve, 200)),
      ]);
    }
  });
}

/** The panel never scrolls sideways at side-panel widths. */
export async function expectNoHorizontalScroll(page: Page) {
  await animationsSettled(page);
  // The page, the notes list (it scrolls on its own) and open dialogs (in the top layer).
  const overflows = await page.evaluate(() =>
    [
      document.documentElement,
      ...document.querySelectorAll<HTMLElement>('[data-scroll-area], dialog[open]'),
    ]
      .filter((element) => element.scrollWidth > element.clientWidth)
      .map((element) => element.getAttribute('aria-label') ?? element.tagName),
  );
  expect(overflows).toEqual([]);
}

// The service worker and extension pages have the raw `chrome` global; borrow WXT's typings.
declare const chrome: typeof browser;

/** Writes notes straight to storage, in the stored layout (`{ [id]: note }`). */
export function seedNotes(session: ExtensionSession, notes: Record<string, unknown>) {
  return session.serviceWorker.evaluate(
    (value) => chrome.storage.local.set({ notes: value }),
    notes,
  );
}

export function readStoredNotes(session: ExtensionSession) {
  return session.serviceWorker.evaluate(
    async () => (await chrome.storage.local.get('notes')).notes as Record<string, unknown>,
  );
}

/** Opens the side panel page in a tab at a side-panel size. */
export async function openPanel(
  session: ExtensionSession,
  { width = 360, colorScheme = 'light' }: { width?: number; colorScheme?: 'light' | 'dark' } = {},
) {
  const panel = await session.context.newPage();
  await panel.emulateMedia({ colorScheme });
  await panel.setViewportSize({ width, height: 760 });
  await panel.goto(panelUrl(session.extensionId));
  await expect(panel.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible();
  await expect(panel.locator('[data-scroll-area]')).toHaveAttribute('aria-busy', 'false');
  return panel;
}

/** The README's sample notebook (examples/sample-notes.json), as 1.0 stored it. */
export const SAMPLE_NOTES = {
  'note-sample-pinned-workflow': {
    title: 'Weekly planning',
    content: 'Review goals, clear inbox, and pick the top three tasks for the week.',
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-16T12:00:00.000Z',
    order: 2,
    pinned: true,
    tags: ['work', 'planning'],
  },
  'note-sample-recipes': {
    title: 'Pasta night',
    content: 'Garlic, olive oil, chili flakes, spaghetti. Finish with parsley and parmesan.',
    createdAt: '2026-09-12T15:30:00.000Z',
    order: 1,
    pinned: false,
    tags: ['recipes', 'personal'],
  },
  'note-sample-reading': {
    title: 'Reading list',
    content: '1) Deep Work 2) The Design of Everyday Things 3) Staff Engineer',
    createdAt: '2026-09-14T09:00:00.000Z',
    updatedAt: '2026-09-20T18:45:00.000Z',
    order: 0,
    pinned: false,
    tags: ['personal', 'learning'],
  },
  'note-sample-snippet': {
    title: 'Clipboard tip',
    content:
      'Select text on any page, right-click, and choose "Save to Notes" to clip it into the side panel.',
    createdAt: '2026-09-18T11:20:00.000Z',
    order: 3,
    pinned: true,
    tags: ['tips'],
  },
};

/** A note card by its title. */
export const card = (page: Page, title: string) =>
  page.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) });
