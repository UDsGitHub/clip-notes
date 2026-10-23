const LOCK_NAME = 'clip-notes:notes';

let tail: Promise<unknown> = Promise.resolve();

/**
 * Runs `task` while holding the notes lock, so read-modify-write cycles never interleave. Web
 * Locks are shared by every extension page and the service worker (one origin), so two side
 * panels and a clip from the context menu can't overwrite each other's writes. Where Web Locks
 * are missing (unit tests), a promise chain serializes tasks within this context.
 */
export function withNotesLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (locks) return locks.request(LOCK_NAME, task);

  const run = tail.then(task, task);
  tail = run.catch(() => undefined);
  return run;
}
