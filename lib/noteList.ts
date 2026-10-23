import type { Note } from './types';

export interface NoteFilters {
  query: string;
  /** The selected tag chip, or null for All. */
  tag: string | null;
}

function timestamp(note: Note) {
  return Date.parse(note.updatedAt ?? note.createdAt);
}

/** Display order, top first: pinned notes, then by `order` (higher first), then newest first. */
export function sortNotes(notes: readonly Note[]): Note[] {
  return notes.toSorted((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.order !== b.order) return b.order - a.order;
    return timestamp(b) - timestamp(a);
  });
}

/** The highest `order` in a section, or -1 when it's empty. */
export function maxOrder(notes: readonly Note[], pinned: boolean): number {
  let max = -1;
  for (const note of notes) {
    if (note.pinned === pinned && note.order > max) max = note.order;
  }
  return max;
}

export function noteHasTag(note: Pick<Note, 'tags'>, tag: string | null): boolean {
  const active = tag?.trim().toLowerCase();
  if (!active) return true;
  return note.tags.some((entry) => entry.toLowerCase() === active);
}

/** Case-insensitive substring match on the title, body or any tag. */
export function noteMatchesQuery(
  note: Pick<Note, 'title' | 'content' | 'tags'>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (note.title.toLowerCase().includes(q)) return true;
  if (note.content.toLowerCase().includes(q)) return true;
  return note.tags.some((tag) => tag.toLowerCase().includes(q));
}

/** The tag chip scopes the set; search then narrows within it. */
export function noteMatchesFilters(
  note: Pick<Note, 'title' | 'content' | 'tags'>,
  filters: NoteFilters,
): boolean {
  return noteHasTag(note, filters.tag) && noteMatchesQuery(note, filters.query);
}

export function isFiltering(filters: NoteFilters): boolean {
  return filters.query.trim().length > 0 || filters.tag != null;
}

/** Every tag in use, deduped case-insensitively (first spelling wins), sorted A–Z. */
export function collectTags(notes: readonly Note[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const note of notes) {
    for (const tag of note.tags) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags.toSorted((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
