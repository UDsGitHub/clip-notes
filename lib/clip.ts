import { NOTE_TITLE_MAX_LENGTH } from './constants';
import { addNote } from './notes';
import { displayHost, sanitizeWebUrl, truncateText } from './text';
import type { Note } from './types';

/** A clipped note's title: the page title, else its site, else "Untitled". */
export function clipTitle(pageTitle: string | undefined, pageUrl: string | undefined): string {
  const title = pageTitle?.replace(/\s+/g, ' ').trim();
  // Room for the "..." so the title still fits the title field when edited.
  if (title) return truncateText(title, NOTE_TITLE_MAX_LENGTH - 3);
  const url = sanitizeWebUrl(pageUrl);
  return url ? displayHost(url) : 'Untitled';
}

/**
 * Saves selected page text as a new note. Runs in the service worker; the side panel shows the
 * note through its storage listener, whether it was already open or opens meanwhile.
 */
export async function saveClip(clip: {
  text: string | undefined;
  pageTitle?: string | undefined;
  pageUrl?: string | undefined;
}): Promise<Note | undefined> {
  const content = clip.text?.trim();
  if (!content) return undefined;
  return addNote({
    title: clipTitle(clip.pageTitle, clip.pageUrl),
    content,
    tags: [],
    url: sanitizeWebUrl(clip.pageUrl),
  });
}
