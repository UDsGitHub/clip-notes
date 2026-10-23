import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notesToCsv, notesToJson } from './exportNotes';
import { parseNotes } from './importNotes';
import type { Note } from './types';

const example = (name: string) =>
  readFileSync(resolve(import.meta.dirname, '../examples', name), 'utf8');

const CREATED = '2026-09-10T12:00:00.000Z';

describe('parseNotes: format', () => {
  it('picks the format from the file name', () => {
    expect(parseNotes('[]', { filename: 'NOTES.JSON' })).toEqual([]);
    expect(parseNotes('id,title,content,createdAt', { filename: 'notes.csv' })).toEqual([]);
  });

  it('rejects other file types', () => {
    expect(() => parseNotes('[]', { filename: 'notes.txt' })).toThrow(
      'File must be .json or .csv.',
    );
  });

  it('rejects empty input', () => {
    expect(() => parseNotes('  \n ', { format: 'json' })).toThrow('Nothing to import.');
  });
});

describe('parseNotes: JSON', () => {
  it('reads the sample file', () => {
    const notes = parseNotes(example('sample-notes.json'), { format: 'json' });
    expect(notes).toHaveLength(4);
    expect(notes[0]).toMatchObject({ id: 'note-sample-pinned-workflow', pinned: true });
  });

  it('defaults pinned and tags, and keeps order only as given', () => {
    const [note] = parseNotes(
      JSON.stringify([{ id: 'a', title: 'T', content: 'C', createdAt: CREATED }]),
      { format: 'json' },
    );
    expect(note).toEqual({
      id: 'a',
      title: 'T',
      content: 'C',
      createdAt: CREATED,
      pinned: false,
      tags: [],
    });
  });

  it('reads every optional field', () => {
    const [note] = parseNotes(
      JSON.stringify([
        {
          id: 'a',
          title: 'T',
          content: 'C',
          createdAt: CREATED,
          updatedAt: '2026-09-11T12:00:00.000Z',
          order: 3,
          pinned: 1,
          tags: ['x', 'X', 'y'],
          url: 'https://example.com/a',
        },
      ]),
      { format: 'json' },
    );
    expect(note).toMatchObject({
      updatedAt: '2026-09-11T12:00:00.000Z',
      order: 3,
      pinned: true,
      tags: ['x', 'y'],
      url: 'https://example.com/a',
    });
  });

  it('stores dates as ISO', () => {
    const [note] = parseNotes(
      JSON.stringify([{ id: 'a', title: 'T', content: 'C', createdAt: '2026-09-10 12:00Z' }]),
      { format: 'json' },
    );
    expect(note!.createdAt).toBe(CREATED);
  });

  it.each([
    ['not JSON', '{oops', 'Invalid JSON.'],
    ['not an array', '{}', 'JSON must be an array of notes.'],
    ['a non-object', '[3]', 'Note 1 is not a note object.'],
    [
      'a missing title',
      `[{"id":"a","content":"C","createdAt":"${CREATED}"}]`,
      'Note 1 is missing a title.',
    ],
    [
      'a blank content',
      `[{"id":"a","title":"T","content":"  ","createdAt":"${CREATED}"}]`,
      'Note 1 is missing a content.',
    ],
    [
      'a bad date',
      '[{"id":"a","title":"T","content":"C","createdAt":"soon"}]',
      'Note 1 has an invalid createdAt.',
    ],
    [
      'a bad order',
      `[{"id":"a","title":"T","content":"C","createdAt":"${CREATED}","order":"x"}]`,
      'Note 1 has an invalid order.',
    ],
    [
      'a bad pinned',
      `[{"id":"a","title":"T","content":"C","createdAt":"${CREATED}","pinned":"yes"}]`,
      'Note 1 has an invalid pinned value.',
    ],
    [
      'bad tags',
      `[{"id":"a","title":"T","content":"C","createdAt":"${CREATED}","tags":[1]}]`,
      'Note 1 has an invalid tags value.',
    ],
    [
      'a bad url',
      `[{"id":"a","title":"T","content":"C","createdAt":"${CREATED}","url":"javascript:x"}]`,
      'Note 1 has an invalid url.',
    ],
    [
      'a reserved id',
      `[{"id":"__proto__","title":"T","content":"C","createdAt":"${CREATED}"}]`,
      'Note 1 has an invalid id.',
    ],
  ])('rejects %s', (_label, text, message) => {
    expect(() => parseNotes(text, { format: 'json' })).toThrow(message);
  });

  it('rejects duplicate ids within the file', () => {
    const note = { id: 'a', title: 'T', content: 'C', createdAt: CREATED };
    expect(() => parseNotes(JSON.stringify([note, note]), { format: 'json' })).toThrow(
      'Duplicate id in import: a.',
    );
  });
});

describe('parseNotes: CSV', () => {
  it('reads the sample file', () => {
    const notes = parseNotes(example('sample-notes.csv'), { filename: 'sample-notes.csv' });
    expect(notes).toHaveLength(4);
    expect(notes.find((n) => n.id === 'note-sample-snippet')).toMatchObject({
      content:
        'Select text on any page, right-click, and choose "Save to Notes" to clip it into the side panel.',
      pinned: true,
      tags: ['tips'],
      order: 3,
    });
  });

  it.each([
    ['1.0 before order', 'id,title,content,createdAt,updatedAt', 5],
    ['1.0 with order', 'id,title,content,createdAt,updatedAt,order', 6],
    ['1.0 with pinned', 'id,title,content,createdAt,updatedAt,order,pinned', 7],
    ['1.0 with tags', 'id,title,content,createdAt,updatedAt,order,pinned,tags', 8],
  ])('reads exports from %s', (_label, header, columns) => {
    const row = ['"a"', '"T"', '"C"', `"${CREATED}"`, '""', '2', 'true', '"x;y"'].slice(0, columns);
    const [note] = parseNotes(`${header}\n${row.join(',')}`, { format: 'csv' });
    expect(note).toMatchObject({ id: 'a', title: 'T', content: 'C', createdAt: CREATED });
    expect(note).not.toHaveProperty('updatedAt');
  });

  it('reads columns in any order, with CRLF rows and quoted commas and newlines', () => {
    const csv =
      'title,id,createdAt,content\r\n"Hi, there",a,' + CREATED + ',"line 1\nline ""2"""\r\n';
    expect(parseNotes(csv, { format: 'csv' })).toEqual([
      {
        id: 'a',
        title: 'Hi, there',
        content: 'line 1\nline "2"',
        createdAt: CREATED,
        pinned: false,
        tags: [],
      },
    ]);
  });

  it.each([
    ['an unknown column', 'id,title,content,createdAt,color', 'Unknown CSV column "color".'],
    ['a missing column', 'id,title,createdAt', 'CSV is missing the content column.'],
    ['a repeated column', 'id,title,content,createdAt,id', 'CSV has a repeated column.'],
    [
      'a short row',
      `id,title,content,createdAt\n"a","T","C"`,
      'Row 2 has the wrong number of columns.',
    ],
    ['an unclosed quote', `id,title,content,createdAt\n"a,"T"`, 'CSV has an unclosed quote.'],
  ])('rejects %s', (_label, text, message) => {
    expect(() => parseNotes(text, { format: 'csv' })).toThrow(message);
  });
});

describe('export → import round trip', () => {
  const notes: Note[] = [
    {
      id: 'note-1',
      title: 'Quotes "and", commas',
      content: 'Line one\nLine two; with "quotes"',
      tags: ['a', 'b c'],
      createdAt: CREATED,
      updatedAt: '2026-09-11T12:00:00.000Z',
      order: 1,
      pinned: true,
      url: 'https://example.com/page?x=1',
    },
    {
      id: 'note-2',
      title: 'Plain',
      content: 'Body',
      tags: [],
      createdAt: CREATED,
      order: 0,
      pinned: false,
    },
  ];

  it('JSON keeps every field', () => {
    expect(parseNotes(notesToJson(notes), { format: 'json' })).toEqual(notes);
  });

  it('CSV keeps every field', () => {
    expect(parseNotes(notesToCsv(notes), { format: 'csv' })).toEqual(notes);
  });
});
