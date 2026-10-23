import { fakeBrowser } from 'wxt/testing/fake-browser';
import { clipTitle, saveClip } from './clip';
import { NOTE_TITLE_MAX_LENGTH } from './constants';
import { readNotes } from './notes';

beforeEach(() => fakeBrowser.reset());

describe('clipTitle', () => {
  it('uses the page title, whitespace collapsed', () => {
    expect(clipTitle('  How to   bake\nbread ', 'https://example.com')).toBe('How to bake bread');
  });

  it('shortens a long page title to fit the title field', () => {
    const title = clipTitle('word '.repeat(30), undefined);
    expect(title.length).toBeLessThanOrEqual(NOTE_TITLE_MAX_LENGTH);
    expect(title.endsWith('...')).toBe(true);
  });

  it('falls back to the site, then to Untitled', () => {
    expect(clipTitle('', 'https://www.example.com/a')).toBe('example.com');
    expect(clipTitle(undefined, 'chrome://newtab')).toBe('Untitled');
    expect(clipTitle(undefined, undefined)).toBe('Untitled');
  });
});

describe('saveClip', () => {
  it('saves the trimmed selection with the page title and URL', async () => {
    const note = await saveClip({
      text: '  clipped text \n',
      pageTitle: 'An article',
      pageUrl: 'https://example.com/article',
    });
    expect(note).toMatchObject({
      title: 'An article',
      content: 'clipped text',
      url: 'https://example.com/article',
      tags: [],
      pinned: false,
    });
    expect(await readNotes()).toHaveLength(1);
  });

  it('drops a page URL that is not http(s)', async () => {
    const note = await saveClip({ text: 'x', pageTitle: 'PDF', pageUrl: 'file:///a.pdf' });
    expect(note).not.toHaveProperty('url');
  });

  it('saves nothing for an empty selection', async () => {
    expect(await saveClip({ text: '   ' })).toBeUndefined();
    expect(await saveClip({ text: undefined })).toBeUndefined();
    expect(await readNotes()).toEqual([]);
  });

  it('keeps every clip when several land at once (1.0 kept only the last)', async () => {
    await Promise.all(['one', 'two', 'three'].map((text) => saveClip({ text })));
    expect((await readNotes()).map((n) => n.content).sort()).toEqual(['one', 'three', 'two']);
  });
});
