import { csvField } from './csv';
import { downloadBlob } from './download';
import { CSV_COLUMNS, type ImportFormat } from './importNotes';
import { sortNotes } from './noteList';
import { readNotes } from './notes';
import { serializeTagsCsv } from './text';
import type { Note } from './types';

export const EXPORT_FILENAMES: Record<ImportFormat, string> = {
  json: 'clip-notes_notes.json',
  csv: 'clip-notes_notes.csv',
};

/** Notes in display order, as a JSON array (the format `parseNotes` reads back). */
export function notesToJson(notes: readonly Note[]): string {
  return JSON.stringify(sortNotes(notes), undefined, 2);
}

/** Notes in display order as CSV; tags are joined with `;`. */
export function notesToCsv(notes: readonly Note[]): string {
  const lines: string[] = [CSV_COLUMNS.join(',')];
  for (const note of sortNotes(notes)) {
    const cells: Record<(typeof CSV_COLUMNS)[number], string> = {
      id: csvField(note.id),
      title: csvField(note.title),
      content: csvField(note.content),
      createdAt: csvField(note.createdAt),
      updatedAt: csvField(note.updatedAt ?? ''),
      order: String(note.order),
      pinned: String(note.pinned),
      tags: csvField(serializeTagsCsv(note.tags)),
      url: csvField(note.url ?? ''),
    };
    lines.push(CSV_COLUMNS.map((column) => cells[column]).join(','));
  }
  return lines.join('\n');
}

/** Saves every note to the Downloads folder as JSON or CSV. */
export async function exportNotes(format: ImportFormat): Promise<void> {
  const notes = await readNotes();
  const blob =
    format === 'json'
      ? new Blob([notesToJson(notes)], { type: 'application/json' })
      : new Blob([notesToCsv(notes)], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, EXPORT_FILENAMES[format]);
}
