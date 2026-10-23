import { fakeBrowser } from 'wxt/testing/fake-browser';
import { NOTES_STORAGE_KEY } from './constants';
import { csvField, parseCsv } from './csv';
import { EXPORT_FILENAMES, exportNotes, notesToCsv, notesToJson } from './exportNotes';
import type { Note } from './types';

const note = (id: string, overrides: Partial<Note> = {}): Note => ({
  id,
  title: id,
  content: `${id} body`,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  order: 0,
  pinned: false,
  ...overrides,
});

describe('notesToJson', () => {
  it('lists notes in display order', () => {
    const json = notesToJson([
      note('low', { order: 0 }),
      note('pinned', { pinned: true }),
      note('high', { order: 5 }),
    ]);
    expect(JSON.parse(json).map((n: Note) => n.id)).toEqual(['pinned', 'high', 'low']);
  });
});

describe('notesToCsv', () => {
  it('writes the header and one quoted row per note', () => {
    const csv = notesToCsv([
      note('a', { title: 'Say "hi", ok', tags: ['x', 'y'], url: 'https://example.com/' }),
    ]);
    expect(csv).toBe(
      [
        'id,title,content,createdAt,updatedAt,order,pinned,tags,url',
        '"a","Say ""hi"", ok","a body","2026-01-01T00:00:00.000Z","",0,false,"x;y","https://example.com/"',
      ].join('\n'),
    );
  });

  it('writes an empty notebook as the header alone', () => {
    expect(notesToCsv([])).toBe('id,title,content,createdAt,updatedAt,order,pinned,tags,url');
  });
});

describe('csv helpers', () => {
  it('quotes and escapes fields that parse back', () => {
    const fields = ['plain', 'a,b', 'say "x"', 'two\nlines', ''];
    expect(parseCsv(fields.map(csvField).join(','))).toEqual([fields]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('exportNotes', () => {
  beforeEach(() => fakeBrowser.reset());

  it.each([['json'], ['csv']] as const)(
    'downloads %s through a link, with no permission',
    async (format) => {
      await fakeBrowser.storage.local.set({
        [NOTES_STORAGE_KEY]: {
          a: { title: 'T', content: 'C', createdAt: '2026-01-01T00:00:00.000Z', order: 0 },
        },
      });
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        expect(this.download).toBe(EXPORT_FILENAMES[format]);
        expect(this.href).toBe('blob:fake');
      });

      await exportNotes(format);

      expect(click).toHaveBeenCalledOnce();
      const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
      const text = await blob.text();
      expect(text).toContain(format === 'json' ? '"title": "T"' : '"a","T","C"');
      expect(document.querySelector('a[download]')).toBeNull();
      vi.restoreAllMocks();
    },
  );
});
