import { card, expect, openPanel, test } from './fixtures';

declare const chrome: typeof browser;

// Side panels in two windows, and clips saved by the service worker, all write the same notes.
test('a change in one panel shows in another at once', async ({ session }) => {
  const first = await openPanel(session);
  const second = await openPanel(session);

  await first.getByRole('textbox', { name: 'Title' }).fill('From the first window');
  await first.getByRole('textbox', { name: 'Note' }).fill('Hello');
  await first.getByRole('button', { name: 'Add note' }).click();
  await expect(card(second, 'From the first window')).toBeVisible();

  await second.getByRole('button', { name: 'Delete From the first window' }).click();
  await expect(card(first, 'From the first window')).toHaveCount(0);
});

test('writes from several pages at once are all kept (Web Locks)', async ({ session }) => {
  const pages = await Promise.all([openPanel(session), openPanel(session), openPanel(session)]);
  await Promise.all(
    pages.map((page, index) => {
      page.getByRole('textbox', { name: 'Title' }).fill(`Note ${index}`);
      return (async () => {
        await page.getByRole('textbox', { name: 'Title' }).fill(`Note ${index}`);
        await page.getByRole('textbox', { name: 'Note' }).fill('body');
        await page.getByRole('button', { name: 'Add note' }).click();
      })();
    }),
  );
  for (const page of pages) {
    await expect(page.locator('[data-note-id]')).toHaveCount(3);
  }
});

test('a clip saved by the service worker appears in an open panel', async ({ session }) => {
  const panel = await openPanel(session);
  // The background's write, as `saveClip` makes it (the context menu itself can't be clicked).
  await session.serviceWorker.evaluate(() =>
    chrome.storage.local.set({
      notes: {
        'note-clip': {
          title: 'An article',
          content: 'Selected text',
          tags: [],
          createdAt: new Date().toISOString(),
          order: 0,
          pinned: false,
          url: 'https://example.com/article',
        },
      },
    }),
  );
  await expect(card(panel, 'An article')).toBeVisible();
  await expect(card(panel, 'An article').getByRole('link', { name: 'example.com' })).toBeVisible();
});
