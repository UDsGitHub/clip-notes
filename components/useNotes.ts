import { useEffect, useState } from 'react';
import { readNotes, watchNotes } from '@/lib/notes';
import type { Note } from '@/lib/types';

/**
 * Every note, kept in sync with storage: this panel's writes, another window's panel, and clips
 * saved by the service worker all arrive through the storage listener. Null until the first
 * read finishes. `setNotes` shows a change before storage confirms it (drag and drop).
 */
export function useNotes() {
  const [notes, setNotes] = useState<Note[] | null>(null);

  useEffect(() => {
    let active = true;
    const unwatch = watchNotes((next) => {
      if (active) setNotes(next);
    });
    readNotes()
      .catch((error: unknown) => {
        console.error('Reading notes failed', error);
        return [];
      })
      // A change that arrived while reading is newer than what the read saw.
      .then((initial) => {
        if (active) setNotes((current) => current ?? initial);
      });
    return () => {
      active = false;
      unwatch();
    };
  }, []);

  return [notes, setNotes] as const;
}
