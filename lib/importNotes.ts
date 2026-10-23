import { parseCsv } from './csv';
import { isUsableId, type ImportedNote } from './notes';
import { normalizeTags, sanitizeWebUrl } from './text';

export type ImportFormat = 'json' | 'csv';

export type ParseNotesOptions = { filename: string } | { format: ImportFormat };

export const CSV_COLUMNS = [
  'id',
  'title',
  'content',
  'createdAt',
  'updatedAt',
  'order',
  'pinned',
  'tags',
  'url',
] as const;
type CsvColumn = (typeof CSV_COLUMNS)[number];
const REQUIRED_COLUMNS: readonly CsvColumn[] = ['id', 'title', 'content', 'createdAt'];

/**
 * Parses an export file (or pasted text) into notes, or throws an Error whose message is shown
 * to the user. Accepts every format Clip Notes has exported: JSON arrays, and CSV with any of the
 * known columns in any order (older exports lack `order`, `pinned`, `tags` and `url`).
 */
export function parseNotes(text: string, options: ParseNotesOptions): ImportedNote[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Nothing to import.');

  const format = 'filename' in options ? formatFromFilename(options.filename) : options.format;
  const notes = format === 'json' ? parseJsonNotes(trimmed) : parseCsvNotes(trimmed);

  const seen = new Set<string>();
  for (const note of notes) {
    if (seen.has(note.id)) throw new Error(`Duplicate id in import: ${note.id}.`);
    seen.add(note.id);
  }
  return notes;
}

function formatFromFilename(filename: string): ImportFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.csv')) return 'csv';
  throw new Error('File must be .json or .csv.');
}

function parseJsonNotes(text: string): ImportedNote[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON.');
  }
  if (!Array.isArray(data)) throw new Error('JSON must be an array of notes.');
  return data.map((item, index) => validateNote(item, `Note ${index + 1}`));
}

function parseCsvNotes(text: string): ImportedNote[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('CSV is empty.');

  const columns = header.map((name) => name.trim());
  for (const name of columns) {
    if (!(CSV_COLUMNS as readonly string[]).includes(name)) {
      throw new Error(`Unknown CSV column "${name}". Expected ${CSV_COLUMNS.join(',')}.`);
    }
  }
  if (new Set(columns).size !== columns.length) throw new Error('CSV has a repeated column.');
  const missing = REQUIRED_COLUMNS.filter((name) => !columns.includes(name));
  if (missing.length > 0) throw new Error(`CSV is missing the ${missing.join(', ')} column.`);

  return rows.map((row, index) => {
    const label = `Row ${index + 2}`;
    if (row.length !== columns.length) throw new Error(`${label} has the wrong number of columns.`);
    const record: Record<string, string> = {};
    columns.forEach((name, i) => {
      // Empty optional cells mean "not set", as in exports of notes without them.
      if (row[i] !== '' || REQUIRED_COLUMNS.includes(name as CsvColumn)) record[name] = row[i]!;
    });
    return validateNote(record, label);
  });
}

function validateNote(value: unknown, label: string): ImportedNote {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is not a note object.`);
  }
  const record = value as Record<string, unknown>;

  const id = requireString(record.id, 'id', label);
  if (!isUsableId(id)) throw new Error(`${label} has an invalid id.`);
  const note: ImportedNote = {
    id,
    title: requireString(record.title, 'title', label),
    content: requireString(record.content, 'content', label),
    createdAt: requireDate(record.createdAt, 'createdAt', label),
    pinned: false,
    tags: [],
  };

  if (isSet(record.updatedAt)) note.updatedAt = requireDate(record.updatedAt, 'updatedAt', label);

  if (isSet(record.order)) {
    const order = typeof record.order === 'string' ? Number(record.order) : record.order;
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      throw new Error(`${label} has an invalid order.`);
    }
    note.order = order;
  }

  if (isSet(record.pinned)) note.pinned = parsePinned(record.pinned, label);

  if (isSet(record.tags)) {
    const valid =
      typeof record.tags === 'string' ||
      (Array.isArray(record.tags) && record.tags.every((tag) => typeof tag === 'string'));
    if (!valid) throw new Error(`${label} has an invalid tags value.`);
    note.tags = normalizeTags(record.tags);
  }

  if (isSet(record.url)) {
    const url = sanitizeWebUrl(record.url);
    if (!url) throw new Error(`${label} has an invalid url.`);
    note.url = url;
  }

  return note;
}

function isSet(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function requireString(value: unknown, field: string, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is missing a ${field}.`);
  }
  return value;
}

function requireDate(value: unknown, field: string, label: string): string {
  const text = requireString(value, field, label);
  const time = Date.parse(text);
  if (Number.isNaN(time)) throw new Error(`${label} has an invalid ${field}.`);
  // Stored dates are ISO, so sorting and display work the same for every note.
  return new Date(time).toISOString();
}

function parsePinned(value: unknown, label: string): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  throw new Error(`${label} has an invalid pinned value.`);
}
