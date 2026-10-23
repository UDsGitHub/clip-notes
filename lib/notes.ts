import { NOTES_STORAGE_KEY } from './constants';
import { withNotesLock } from './lock';
import { maxOrder, sortNotes } from './noteList';
import { normalizeTags, sanitizeWebUrl } from './text';
import type { Note, NoteDraft, StoredNote } from './types';

/**
 * Every read and write of notes goes through this module. Notes live in `chrome.storage.local`
 * under `notes` as `{ [id]: StoredNote }`, the layout every published version has used, so an
 * update never needs to migrate data. Writes run under `withNotesLock` and rewrite the whole map.
 */

export class NoteNotFoundError extends Error {
  constructor(id: string) {
    super(`Note not found: ${id}`);
    this.name = 'NoteNotFoundError';
  }
}

/** Ids that would be unsafe as keys of a plain object. */
const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

export function isUsableId(id: string): boolean {
  return id.trim() !== '' && !RESERVED_IDS.has(id);
}

const EPOCH = new Date(0).toISOString();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): string | undefined {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

/**
 * Turns whatever is stored into valid notes. Entries that aren't objects are dropped, and missing
 * fields get defaults. Notes from before manual ordering have no `order`: as 1.0 did, all notes
 * are then numbered by recency (newest on top). The result is written back on the next change.
 */
export function normalizeStoredNotes(raw: unknown): Note[] {
  if (!isRecord(raw)) return [];

  const notes: Note[] = [];
  let missingOrder = false;
  for (const [id, value] of Object.entries(raw)) {
    if (!isUsableId(id) || !isRecord(value)) continue;
    const order =
      typeof value.order === 'number' && Number.isFinite(value.order) ? value.order : undefined;
    if (order === undefined) missingOrder = true;
    const updatedAt = validDate(value.updatedAt);
    const url = sanitizeWebUrl(value.url);
    notes.push({
      id,
      title: typeof value.title === 'string' ? value.title : '',
      content: typeof value.content === 'string' ? value.content : '',
      tags: normalizeTags(value.tags),
      createdAt: validDate(value.createdAt) ?? EPOCH,
      ...(updatedAt ? { updatedAt } : {}),
      order: order ?? 0,
      pinned: value.pinned === true,
      ...(url ? { url } : {}),
    });
  }

  if (!missingOrder) return notes;

  const byRecency = notes.toSorted(
    (a, b) => Date.parse(a.updatedAt ?? a.createdAt) - Date.parse(b.updatedAt ?? b.createdAt),
  );
  return byRecency.map((note, index) => ({ ...note, order: index }));
}

function toStored(notes: readonly Note[]): Record<string, StoredNote> {
  return Object.fromEntries(notes.map(({ id, ...note }) => [id, note]));
}

export async function readNotes(): Promise<Note[]> {
  const result = await browser.storage.local.get(NOTES_STORAGE_KEY);
  return normalizeStoredNotes(result[NOTES_STORAGE_KEY]);
}

async function writeNotes(notes: readonly Note[]): Promise<void> {
  await browser.storage.local.set({ [NOTES_STORAGE_KEY]: toStored(notes) });
}

/** Reads the notes under the lock, lets `change` edit them, and writes the result if it returns one. */
async function mutate<T>(change: (notes: Note[]) => { notes?: Note[]; result: T }): Promise<T> {
  return withNotesLock(async () => {
    const { notes, result } = change(await readNotes());
    if (notes) await writeNotes(notes);
    return result;
  });
}

const now = () => new Date().toISOString();

/** Adds a note at the top of the unpinned section. */
export function addNote(draft: NoteDraft & { url?: string | undefined }): Promise<Note> {
  return mutate((notes) => {
    const url = sanitizeWebUrl(draft.url);
    const note: Note = {
      id: `note-${crypto.randomUUID()}`,
      title: draft.title,
      content: draft.content,
      tags: normalizeTags(draft.tags),
      createdAt: now(),
      order: maxOrder(notes, false) + 1,
      pinned: false,
      ...(url ? { url } : {}),
    };
    return { notes: [...notes, note], result: note };
  });
}

/** Changes a note's title, body and tags. Throws `NoteNotFoundError` if it was deleted meanwhile. */
export function updateNote(id: string, draft: NoteDraft): Promise<Note> {
  return mutate((notes) => {
    const existing = notes.find((note) => note.id === id);
    if (!existing) throw new NoteNotFoundError(id);
    const updated: Note = {
      ...existing,
      title: draft.title,
      content: draft.content,
      tags: normalizeTags(draft.tags),
      updatedAt: now(),
    };
    return { notes: notes.map((note) => (note.id === id ? updated : note)), result: updated };
  });
}

/** Pins or unpins a note, moving it to the top of its new section. */
export function setPinned(id: string, pinned: boolean): Promise<Note> {
  return mutate((notes) => {
    const existing = notes.find((note) => note.id === id);
    if (!existing) throw new NoteNotFoundError(id);
    if (existing.pinned === pinned) return { result: existing };
    const updated: Note = { ...existing, pinned, order: maxOrder(notes, pinned) + 1 };
    return { notes: notes.map((note) => (note.id === id ? updated : note)), result: updated };
  });
}

/** Deletes a note and returns it (for Undo), or undefined if it was already gone. */
export function deleteNote(id: string): Promise<Note | undefined> {
  return mutate((notes) => {
    const removed = notes.find((note) => note.id === id);
    if (!removed) return { result: undefined };
    return { notes: notes.filter((note) => note.id !== id), result: removed };
  });
}

/** Puts a deleted note back exactly as it was. Returns false if its id is in use again. */
export function restoreNote(note: Note): Promise<boolean> {
  return mutate((notes) => {
    if (notes.some((existing) => existing.id === note.id)) return { result: false };
    return { notes: [...notes, note], result: true };
  });
}

export function clearNotes(): Promise<void> {
  return mutate(() => ({ notes: [], result: undefined }));
}

/**
 * Moves note `id` to where `overId` sits within their section (as a drag and drop does), then
 * renumbers the section. Works from the stored order, so a note another window added meanwhile
 * keeps its place. Does nothing if either note is gone or they're in different sections.
 */
export function moveNote(id: string, overId: string): Promise<void> {
  return mutate((notes) => {
    const moved = applyMove(notes, id, overId);
    return { ...(moved !== notes ? { notes: moved } : {}), result: undefined };
  });
}

/** `moveNote`'s change, pure: returns `notes` itself when nothing moves. */
export function applyMove(notes: Note[], id: string, overId: string): Note[] {
  const moving = notes.find((note) => note.id === id);
  if (!moving || id === overId) return notes;
  const section = sortNotes(notes).filter((note) => note.pinned === moving.pinned);
  const from = section.findIndex((note) => note.id === id);
  const to = section.findIndex((note) => note.id === overId);
  if (to === -1) return notes;

  const reordered = section.toSpliced(from, 1).toSpliced(to, 0, moving);
  const orders = new Map(reordered.map((note, index) => [note.id, reordered.length - 1 - index]));
  return notes.map((note) =>
    orders.has(note.id) ? { ...note, order: orders.get(note.id)! } : note,
  );
}

/** A parsed note from an import file; `order` is only a ranking hint. */
export type ImportedNote = Omit<Note, 'order'> & { order?: number };

/**
 * Adds imported notes, skipping ids that already exist. Each section's imported notes go above
 * the notes already there, in the file's order (by `order` when every note has one, otherwise
 * as listed, which is how exports list them).
 */
export function importNotes(
  incoming: readonly ImportedNote[],
): Promise<{ imported: number; skipped: number }> {
  return mutate((notes) => {
    const existingIds = new Set(notes.map((note) => note.id));
    const fresh = incoming.filter((note) => !existingIds.has(note.id));
    const skipped = incoming.length - fresh.length;
    if (fresh.length === 0) return { result: { imported: 0, skipped } };

    const added: Note[] = [];
    for (const pinned of [true, false]) {
      const section = fresh.filter((note) => note.pinned === pinned);
      const ranked = section.every((note) => note.order !== undefined)
        ? section.toSorted((a, b) => b.order! - a.order!)
        : section;
      const base = maxOrder(notes, pinned) + 1;
      ranked.forEach((note, index) => {
        added.push({ ...note, order: base + ranked.length - 1 - index });
      });
    }
    return { notes: [...notes, ...added], result: { imported: fresh.length, skipped } };
  });
}

/** Calls `listener` with the notes whenever any context (another panel, a clip) changes them. */
export function watchNotes(listener: (notes: Note[]) => void): () => void {
  const onChanged = (changes: Record<string, { newValue?: unknown }>) => {
    if (NOTES_STORAGE_KEY in changes) {
      listener(normalizeStoredNotes(changes[NOTES_STORAGE_KEY]!.newValue));
    }
  };
  browser.storage.local.onChanged.addListener(onChanged);
  return () => browser.storage.local.onChanged.removeListener(onChanged);
}
