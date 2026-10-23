import fs from 'node:fs';
import {
  card,
  expect,
  expectNoHorizontalScroll,
  openPanel,
  readStoredNotes,
  SAMPLE_NOTES,
  seedNotes,
  test,
} from './fixtures';
import type { Page } from '@playwright/test';

const titles = (panel: Page) => panel.locator('[data-note-id] .font-bold').allTextContents();

test('add, edit, pin, delete with Undo, in the production build', async ({ session }) => {
  const panel = await openPanel(session, { width: 320 });
  await expect(panel.getByText('No notes yet. Add one below.')).toBeVisible();

  await panel.getByRole('textbox', { name: 'Title' }).fill('Groceries');
  await panel.getByRole('textbox', { name: 'Note' }).fill('Eggs\nMilk');
  await panel.getByRole('textbox', { name: 'Tags (comma-separated)' }).fill('home');
  await panel.keyboard.press('ControlOrMeta+Enter');
  await panel.getByRole('textbox', { name: 'Title' }).fill('Work');
  await panel.getByRole('textbox', { name: 'Note' }).fill('Ship it');
  await panel.getByRole('button', { name: 'Add note' }).click();
  await expect.poll(() => titles(panel)).toEqual(['Work', 'Groceries']);
  await expectNoHorizontalScroll(panel);

  await card(panel, 'Groceries').getByRole('button', { name: 'Edit Groceries' }).click();
  await expect(panel.getByRole('textbox', { name: 'Note' })).toHaveValue('Eggs\nMilk');
  await panel.getByRole('textbox', { name: 'Note' }).fill('Eggs\nMilk\nBread');
  await panel.getByRole('button', { name: 'Save changes' }).click();
  await expect(card(panel, 'Groceries')).toContainText('Bread');

  await card(panel, 'Groceries').getByRole('button', { name: 'Pin Groceries' }).click();
  await expect(panel.getByRole('heading', { name: 'Pinned' })).toBeVisible();
  await expect.poll(() => titles(panel)).toEqual(['Groceries', 'Work']);

  await card(panel, 'Work').getByRole('button', { name: 'Delete Work' }).click();
  await expect.poll(() => titles(panel)).toEqual(['Groceries']);
  await panel.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => titles(panel)).toEqual(['Groceries', 'Work']);

  // Survives a reload: it's all in chrome.storage.local.
  await panel.reload();
  await expect.poll(() => titles(panel)).toEqual(['Groceries', 'Work']);
});

test('search and tag chips filter the list', async ({ session }) => {
  await seedNotes(session, SAMPLE_NOTES);
  const panel = await openPanel(session);
  await panel.getByRole('button', { name: 'personal', exact: true }).click();
  await expect.poll(() => titles(panel)).toEqual(['Pasta night', 'Reading list']);
  await panel.getByRole('searchbox', { name: 'Search notes' }).fill('deep work');
  await expect.poll(() => titles(panel)).toEqual(['Reading list']);
  await panel.getByRole('searchbox', { name: 'Search notes' }).fill('');
  await panel.getByRole('button', { name: 'All', exact: true }).click();
  await expect.poll(() => titles(panel)).toHaveLength(4);
});

test('notes reorder by keyboard, and the order is saved', async ({ session }) => {
  await seedNotes(session, SAMPLE_NOTES);
  const panel = await openPanel(session);
  await expect
    .poll(() => titles(panel))
    .toEqual(['Clipboard tip', 'Weekly planning', 'Pasta night', 'Reading list']);

  const handle = panel.getByRole('button', { name: 'Reorder Pasta night' });
  await handle.focus();
  await panel.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  // dnd-kit measures the cards after pick-up; it announces the starting spot once it has.
  await expect(panel.getByText('Pasta night moved to position 1.')).toBeAttached();
  await panel.keyboard.press('ArrowDown');
  await expect(panel.getByText('Pasta night moved to position 2.')).toBeAttached();
  await panel.keyboard.press('Space');
  await expect(panel.getByText('Dropped Pasta night at position 2.')).toBeAttached();
  await expect
    .poll(() => titles(panel))
    .toEqual(['Clipboard tip', 'Weekly planning', 'Reading list', 'Pasta night']);

  // The drop shows at once; wait for its write before reloading.
  await expect
    .poll(async () => {
      const stored = (await readStoredNotes(session)) as Record<string, { order: number }>;
      return stored['note-sample-reading']!.order > stored['note-sample-recipes']!.order;
    })
    .toBe(true);
  await panel.reload();
  await expect
    .poll(() => titles(panel))
    .toEqual(['Clipboard tip', 'Weekly planning', 'Reading list', 'Pasta night']);
});

test('notes reorder by mouse within their section', async ({ session }) => {
  await seedNotes(session, SAMPLE_NOTES);
  const panel = await openPanel(session);
  const from = await panel.getByRole('button', { name: 'Reorder Weekly planning' }).boundingBox();
  const to = await card(panel, 'Clipboard tip').boundingBox();
  await panel.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await panel.mouse.down();
  await panel.mouse.move(from!.x + 5, to!.y + 10, { steps: 10 });
  await panel.mouse.move(from!.x + 5, to!.y + 5, { steps: 5 });
  await panel.mouse.up();
  await expect
    .poll(() => titles(panel))
    .toEqual(['Weekly planning', 'Clipboard tip', 'Pasta night', 'Reading list']);
});

test('clicking a note copies its text', async ({ session }) => {
  await session.context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seedNotes(session, SAMPLE_NOTES);
  const panel = await openPanel(session);
  await card(panel, 'Pasta night').getByText('Garlic, olive oil').click();
  await expect(card(panel, 'Pasta night').getByText('Copied')).toBeAttached();
  expect(await panel.evaluate(() => navigator.clipboard.readText())).toBe(
    SAMPLE_NOTES['note-sample-recipes'].content,
  );
});

test('export downloads a file that imports back', async ({ session }) => {
  await seedNotes(session, SAMPLE_NOTES);
  const panel = await openPanel(session);

  for (const format of ['CSV', 'JSON'] as const) {
    await panel.getByRole('button', { name: 'Export notes' }).click();
    const downloading = panel.waitForEvent('download');
    await panel.getByRole('button', { name: `Export as ${format}` }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`clip-notes_notes.${format.toLowerCase()}`);
    const file = await download.path();
    await expect(panel.getByText(`${format} downloaded.`)).toBeVisible();

    await panel.getByRole('button', { name: 'Delete all notes' }).click();
    await panel.getByRole('button', { name: 'Delete all', exact: true }).click();
    await expect(panel.getByText('No notes yet. Add one below.')).toBeVisible();

    await panel.getByRole('button', { name: 'Import notes' }).click();
    await panel.locator('input[type=file]').setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'text/plain',
      buffer: fs.readFileSync(file),
    });
    await panel.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(panel.getByText('Imported 4 notes.')).toBeVisible();
    await expect
      .poll(() => titles(panel))
      .toEqual(['Clipboard tip', 'Weekly planning', 'Pasta night', 'Reading list']);
  }
});

test('a dropped file outside the import area never replaces the panel', async ({ session }) => {
  const panel = await openPanel(session);
  const url = panel.url();
  const transfer = await panel.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['x'], 'x.txt', { type: 'text/plain' }));
    return data;
  });
  await panel.dispatchEvent('main', 'dragover', { dataTransfer: transfer });
  await panel.dispatchEvent('main', 'drop', { dataTransfer: transfer });
  await panel.waitForTimeout(300);
  expect(panel.url()).toBe(url);
  await expect(panel.getByRole('heading', { name: 'Notes' })).toBeVisible();
});

test('long text wraps instead of widening the panel', async ({ session }) => {
  await seedNotes(session, {
    long: {
      title: 'https://example.com/a/very/long/link/that/never/breaks',
      content: 'x'.repeat(400),
      createdAt: '2026-01-01T00:00:00.000Z',
      order: 0,
      pinned: false,
      tags: ['a-very-long-tag-name-ok'],
      url: 'https://subdomain.with-a-long-name.example.com/path',
    },
  });
  const panel = await openPanel(session, { width: 320 });
  await expect(panel.getByRole('button', { name: 'show more' })).toBeVisible();
  await panel.getByRole('button', { name: 'show more' }).click();
  await expectNoHorizontalScroll(panel);
});

test('stores notes in the 1.0 layout, so a downgrade or re-install keeps them', async ({
  session,
}) => {
  const panel = await openPanel(session);
  await panel.getByRole('textbox', { name: 'Title' }).fill('Kept');
  await panel.getByRole('textbox', { name: 'Note' }).fill('Body');
  await panel.getByRole('button', { name: 'Add note' }).click();
  await expect(card(panel, 'Kept')).toBeVisible();
  const stored = await readStoredNotes(session);
  const [id, note] = Object.entries(stored)[0]!;
  expect(id).toMatch(/^note-/);
  expect(note).toEqual({
    title: 'Kept',
    content: 'Body',
    tags: [],
    createdAt: expect.any(String),
    order: 0,
    pinned: false,
  });
});
