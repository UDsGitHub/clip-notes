import { expect, openPanel, readStoredNotes, seedNotes, test } from './fixtures';

// Users updating from the store keep their notes: 1.1 reads every layout 1.0 ever wrote.
test('notes from 1.0, including ones from before ordering, pins and tags, show and keep working', async ({
  session,
}) => {
  await seedNotes(session, {
    'note-a': { title: 'Oldest', content: 'a', createdAt: '2026-01-01T10:00:00.000Z' },
    'note-b': {
      title: 'Edited later',
      content: 'b',
      createdAt: '2025-06-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    },
    'note-c': {
      title: 'Newest',
      content: 'c',
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: null,
    },
  });
  const panel = await openPanel(session);
  const titles = () => panel.locator('[data-note-id] .font-bold').allTextContents();
  await expect.poll(titles).toEqual(['Edited later', 'Newest', 'Oldest']);

  await panel.getByRole('button', { name: 'Pin Oldest' }).click();
  await expect.poll(titles).toEqual(['Oldest', 'Edited later', 'Newest']);
  expect(await readStoredNotes(session)).toMatchObject({
    'note-a': { pinned: true, tags: [] },
    'note-b': { order: 2, pinned: false },
    'note-c': { order: 1, pinned: false },
  });
});
