/** A note as the app uses it: every field the UI needs is present and valid. */
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  /** ISO timestamps. */
  createdAt: string;
  updatedAt?: string;
  /** Higher values sit nearer the top of the note's section (pinned or not). */
  order: number;
  pinned: boolean;
  /** The page a clipped note came from (http or https only). */
  url?: string;
}

/**
 * A note as stored in `chrome.storage.local` under `notes`, keyed by id. Versions before 1.1
 * wrote notes without `order`, `pinned`, `tags` or `url`, and `updatedAt` could be null, so
 * anything read from storage goes through `normalizeStoredNotes` first.
 */
export type StoredNote = Omit<Note, 'id'>;

export type NoteSection = 'pinned' | 'unpinned';

/** What the note form edits. */
export interface NoteDraft {
  title: string;
  content: string;
  tags: string[];
}
