import { NOTE_TAG_MAX_LENGTH, NOTE_TAGS_MAX_COUNT } from './constants';

/**
 * Shortens `text` to at most `maxLength` characters plus "...", at the last space when there is
 * one. Text that fits is returned unchanged, so a "show more" toggle is needed exactly when the
 * result differs from the input.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  let cut = text.slice(0, maxLength);
  // Don't split an emoji or other astral character in half.
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  return `${cut.trimEnd()}...`;
}

/** Trims, collapses whitespace, dedupes case-insensitively, and caps tag length and count. */
export function normalizeTags(input: unknown): string[] {
  const raw: unknown[] = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[,;]/)
      : [];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const tag = item.trim().replace(/\s+/g, ' ').slice(0, NOTE_TAG_MAX_LENGTH).trim();
    if (!tag) continue;

    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);

    if (tags.length >= NOTE_TAGS_MAX_COUNT) break;
  }

  return tags;
}

/** The tags field's text for a note's tags. */
export function formatTagsInput(tags: readonly string[]): string {
  return tags.join(', ');
}

/** Tags in a CSV cell: `;` between values, so commas stay free inside the field. */
export function serializeTagsCsv(tags: readonly string[]): string {
  return tags.join(';');
}

/** An http(s) URL with its whitespace trimmed, or undefined for anything else. */
export function sanitizeWebUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** The hostname to show for a note's source, without a leading `www.`. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
