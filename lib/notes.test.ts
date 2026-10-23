import { fakeBrowser } from 'wxt/testing/fake-browser';
import { NOTES_STORAGE_KEY } from './constants';
import { sortNotes } from './noteList';
import {
  addNote,
  applyMove,
  clearNotes,
  deleteNote,
  importNotes,
  moveNote,
  normalizeStoredNotes,
  NoteNotFoundError,
  readNotes,
  restoreNote,
  setPinned,
  updateNote,
  watchNotes,
} from './notes';
import type { Note } from './types';

async function stored(): Promise<Record<string, Record<string, unknown>>> {
  return (await fakeBrowser.storage.local.get(NOTES_STORAGE_KEY))[NOTES_STORAGE_KEY] as Record<
    string,
    Record<string, unknown>
  >;
}

const seed = (notes: Record<string, unknown>) =>
  fakeBrowser.storage.local.set({ [NOTES_STORAGE_KEY]: notes });

const draft = (title: string, extra: Partial<{ content: string; tags: string[] }> = {}) => ({
  title,
  content: `${title} body`,
  tags: [],
  ...extra,
});

const displayed = async () => sortNotes(await readNotes()).map((note) => note.title);

beforeEach(() => {
  fakeBrowser.reset();
  vi.useRealTimers();
});

describe('normalizeStoredNotes', () => {
  it('reads nothing from missing or malformed storage', () => {
    expect(normalizeStoredNotes(undefined)).toEqual([]);
    expect(normalizeStoredNotes([])).toEqual([]);
    expect(normalizeStoredNotes('notes')).toEqual([]);
  });

  it('fills defaults for notes 1.0 stored without pinned, tags or updatedAt', () => {
    const [note] = normalizeStoredNotes({
      'note-1': {
        title: 'T',
        content: 'C',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
        order: 4,
      },
    });
    expect(note).toEqual({
      id: 'note-1',
      title: 'T',
      content: 'C',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      order: 4,
      pinned: false,
    });
  });

  it('numbers notes from before manual ordering by recency, newest on top (as 1.0 did)', () => {
    const notes = normalizeStoredNotes({
      a: { title: 'oldest', content: '', createdAt: '2026-01-01T00:00:00.000Z' },
      b: { title: 'newest', content: '', createdAt: '2026-01-03T00:00:00.000Z' },
      c: {
        title: 'edited',
        content: '',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    });
    expect(sortNotes(notes).map((n) => n.title)).toEqual(['newest', 'edited', 'oldest']);
  });

  it('drops entries that are not objects, and unsafe ids', () => {
    const raw = JSON.parse(
      '{"ok":{"title":"T","content":"C","createdAt":"2026-01-01T00:00:00.000Z","order":0},"bad":5,"__proto__":{"title":"x"}}',
    );
    expect(normalizeStoredNotes(raw).map((n) => n.id)).toEqual(['ok']);
  });

  it('drops a stored url that is not http(s)', () => {
    const [note] = normalizeStoredNotes({
      a: {
        title: 'T',
        content: 'C',
        createdAt: '2026-01-01T00:00:00.000Z',
        order: 0,
        url: 'javascript:x',
      },
    });
    expect(note).not.toHaveProperty('url');
  });

  it('falls back to the epoch for an unreadable createdAt', () => {
    const [note] = normalizeStoredNotes({ a: { title: 'T', content: 'C', order: 0 } });
    expect(note!.createdAt).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('addNote', () => {
  it('stores a note with an id, timestamps and normalized tags, at the top', async () => {
    await addNote(draft('First'));
    const second = await addNote(draft('Second', { tags: [' a ', 'A', 'b'] }));

    expect(second).toMatchObject({
      id: expect.stringMatching(/^note-[0-9a-f-]{36}$/),
      title: 'Second',
      tags: ['a', 'b'],
      pinned: false,
      order: 1,
      createdAt: expect.any(String),
    });
    expect(await displayed()).toEqual(['Second', 'First']);
    expect((await stored())[second.id]).toEqual({
      title: 'Second',
      content: 'Second body',
      tags: ['a', 'b'],
      createdAt: second.createdAt,
      order: 1,
      pinned: false,
    });
  });

  it('keeps a clip’s source URL', async () => {
    const note = await addNote({ ...draft('Clip'), url: 'https://example.com/a' });
    expect(note.url).toBe('https://example.com/a');
  });

  it('writes the 1.0 notes back with their orders once anything changes', async () => {
    await seed({ old: { title: 'Old', content: 'x', createdAt: '2026-01-01T00:00:00.000Z' } });
    await addNote(draft('New'));
    expect((await stored()).old).toMatchObject({ order: 0, pinned: false, tags: [] });
    expect(await displayed()).toEqual(['New', 'Old']);
  });

  it('never loses a note when several are added at once (1.0 could)', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => addNote(draft(`n${i}`))));
    expect(await readNotes()).toHaveLength(10);
  });
});

describe('updateNote', () => {
  it('changes the title, body and tags and stamps updatedAt', async () => {
    const note = await addNote({ ...draft('Before'), url: 'https://example.com/' });
    const updated = await updateNote(note.id, draft('After', { tags: ['x'] }));
    expect(updated).toMatchObject({
      id: note.id,
      title: 'After',
      tags: ['x'],
      order: note.order,
      url: 'https://example.com/',
      updatedAt: expect.any(String),
    });
  });

  it('throws NoteNotFoundError for a deleted note', async () => {
    await expect(updateNote('gone', draft('x'))).rejects.toBeInstanceOf(NoteNotFoundError);
  });
});

describe('setPinned', () => {
  it('moves the note to the top of its new section', async () => {
    const a = await addNote(draft('A'));
    await addNote(draft('B'));
    const c = await addNote(draft('C'));
    await setPinned(a.id, true);
    await setPinned(c.id, true);
    expect(await displayed()).toEqual(['C', 'A', 'B']);

    await setPinned(a.id, false);
    expect(await displayed()).toEqual(['C', 'A', 'B']);
    expect((await readNotes()).find((n) => n.id === a.id)).toMatchObject({ pinned: false });
  });

  it('does nothing when the state already matches', async () => {
    const a = await addNote(draft('A'));
    const before = await stored();
    await setPinned(a.id, false);
    expect(await stored()).toEqual(before);
  });

  it('throws NoteNotFoundError for a deleted note', async () => {
    await expect(setPinned('gone', true)).rejects.toBeInstanceOf(NoteNotFoundError);
  });

  it('keeps both changes when pin and delete race (1.0 could undo the delete)', async () => {
    const a = await addNote(draft('A'));
    const b = await addNote(draft('B'));
    await Promise.all([setPinned(a.id, true), deleteNote(b.id)]);
    expect(await readNotes()).toEqual([expect.objectContaining({ id: a.id, pinned: true })]);
  });
});

describe('deleteNote and restoreNote', () => {
  it('returns the deleted note, and restoring puts it back exactly', async () => {
    await addNote(draft('A'));
    const b = await addNote(draft('B'));
    await addNote(draft('C'));

    const removed = await deleteNote(b.id);
    expect(removed).toEqual(b);
    expect(await displayed()).toEqual(['C', 'A']);

    expect(await restoreNote(removed!)).toBe(true);
    expect(await displayed()).toEqual(['C', 'B', 'A']);
  });

  it('returns undefined for a note that is already gone', async () => {
    expect(await deleteNote('gone')).toBeUndefined();
  });

  it('does not restore over a note with the same id', async () => {
    const a = await addNote(draft('A'));
    expect(await restoreNote({ ...a, title: 'Other' })).toBe(false);
    expect(await displayed()).toEqual(['A']);
  });
});

describe('clearNotes', () => {
  it('removes every note', async () => {
    await addNote(draft('A'));
    await clearNotes();
    expect(await readNotes()).toEqual([]);
    expect(await stored()).toEqual({});
  });
});

describe('moveNote', () => {
  it('moves a note to another note’s place within its section', async () => {
    for (const title of ['D', 'C', 'B', 'A']) await addNote(draft(title));
    const ids = Object.fromEntries((await readNotes()).map((n) => [n.title, n.id]));

    await moveNote(ids.A!, ids.C!);
    expect(await displayed()).toEqual(['B', 'C', 'A', 'D']);
    await moveNote(ids.D!, ids.B!);
    expect(await displayed()).toEqual(['D', 'B', 'C', 'A']);
  });

  it('ignores a drop across sections, onto itself, or onto a missing note', async () => {
    const a = await addNote(draft('A'));
    const b = await addNote(draft('B'));
    await setPinned(b.id, true);
    const before = await stored();
    await moveNote(a.id, b.id);
    await moveNote(a.id, a.id);
    await moveNote(a.id, 'gone');
    await moveNote('gone', a.id);
    expect(await stored()).toEqual(before);
  });

  it('keeps a note another window added meanwhile in place', async () => {
    const notes: Note[] = ['A', 'B', 'C'].map((title, index) => ({
      id: title,
      title,
      content: '',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      order: 3 - index,
      pinned: false,
    }));
    const moved = applyMove(
      [...notes, { ...notes[0]!, id: 'New', title: 'New', order: 10 }],
      'C',
      'A',
    );
    expect(sortNotes(moved).map((n) => n.title)).toEqual(['New', 'C', 'A', 'B']);
  });
});

describe('importNotes', () => {
  const imported = (id: string, extra: Partial<Note> = {}) => ({
    id,
    title: id,
    content: `${id} body`,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    pinned: false,
    ...extra,
  });

  it('adds new notes and skips ids that exist', async () => {
    const existing = await addNote(draft('Existing'));
    const result = await importNotes([imported(existing.id), imported('x'), imported('y')]);
    expect(result).toEqual({ imported: 2, skipped: 1 });
    expect(await readNotes()).toHaveLength(3);
    expect((await readNotes()).find((n) => n.id === existing.id)!.title).toBe('Existing');
  });

  it('writes nothing when every note is skipped', async () => {
    const existing = await addNote(draft('Existing'));
    const before = await stored();
    expect(await importNotes([imported(existing.id)])).toEqual({ imported: 0, skipped: 1 });
    expect(await stored()).toEqual(before);
  });

  it('places imports above existing notes in their own order, per section (1.0 interleaved them)', async () => {
    await addNote(draft('Mine 1'));
    await addNote(draft('Mine 2'));
    await importNotes([
      imported('Low', { order: 0 }),
      imported('High', { order: 1 }),
      imported('Pinned', { order: 0, pinned: true }),
    ]);
    expect(await displayed()).toEqual(['Pinned', 'High', 'Low', 'Mine 2', 'Mine 1']);
  });

  it('keeps the file’s listed order when notes have no order', async () => {
    await importNotes([imported('First'), imported('Second'), imported('Third')]);
    expect(await displayed()).toEqual(['First', 'Second', 'Third']);
  });

  it('round-trips an export into an empty notebook in the same display order', async () => {
    for (const title of ['C', 'B', 'A']) await addNote(draft(title));
    const notes = sortNotes(await readNotes());
    await setPinned(notes[2]!.id, true);
    const exported = sortNotes(await readNotes());
    await clearNotes();
    await importNotes(exported);
    expect(sortNotes(await readNotes()).map((n) => n.title)).toEqual(exported.map((n) => n.title));
  });
});

describe('watchNotes', () => {
  it('reports every change with normalized notes, until unsubscribed', async () => {
    const listener = vi.fn();
    const unwatch = watchNotes(listener);
    await addNote(draft('A'));
    expect(listener).toHaveBeenLastCalledWith([expect.objectContaining({ title: 'A' })]);

    await fakeBrowser.storage.local.set({ other: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    unwatch();
    await addNote(draft('B'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
