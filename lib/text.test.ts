import { NOTE_TAG_MAX_LENGTH, NOTE_TAGS_MAX_COUNT } from './constants';
import {
  displayHost,
  formatTagsInput,
  normalizeTags,
  sanitizeWebUrl,
  serializeTagsCsv,
  truncateText,
} from './text';

describe('truncateText', () => {
  it('returns text that fits unchanged', () => {
    expect(truncateText('short note', 20)).toBe('short note');
  });

  it('leaves text of exactly the limit alone (1.0 cut it with no way to expand)', () => {
    const text = `${'a'.repeat(9)} ${'b'.repeat(10)}`;
    expect(text).toHaveLength(20);
    expect(truncateText(text, 20)).toBe(text);
  });

  it('cuts at the last space and adds an ellipsis', () => {
    expect(truncateText('the quick brown fox jumps', 18)).toBe('the quick brown...');
  });

  it('adds an ellipsis even when there is no space to cut at (1.0 dropped it)', () => {
    expect(truncateText('x'.repeat(30), 10)).toBe(`${'x'.repeat(10)}...`);
  });

  it('never splits an emoji in half', () => {
    const result = truncateText(`${'a'.repeat(9)}😀tail`, 10);
    expect(result).toBe(`${'a'.repeat(9)}...`);
  });

  it('drops trailing spaces before the ellipsis', () => {
    expect(truncateText('word   another word', 9)).toBe('word...');
  });
});

describe('normalizeTags', () => {
  it('splits strings on commas and semicolons, trims and collapses whitespace', () => {
    expect(normalizeTags(' work ,  big   ideas;personal ')).toEqual([
      'work',
      'big ideas',
      'personal',
    ]);
  });

  it('dedupes case-insensitively, keeping the first spelling', () => {
    expect(normalizeTags(['Work', 'work', 'WORK', 'home'])).toEqual(['Work', 'home']);
  });

  it('drops empty and non-string entries', () => {
    expect(normalizeTags(['', '  ', 3, null, 'ok'])).toEqual(['ok']);
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(42)).toEqual([]);
  });

  it('caps tag length and count', () => {
    const long = 'x'.repeat(NOTE_TAG_MAX_LENGTH + 10);
    expect(normalizeTags([long])[0]).toHaveLength(NOTE_TAG_MAX_LENGTH);
    const many = Array.from({ length: NOTE_TAGS_MAX_COUNT + 5 }, (_, i) => `t${i}`);
    expect(normalizeTags(many)).toHaveLength(NOTE_TAGS_MAX_COUNT);
  });

  it('trims a space left at the cut', () => {
    const tag = `${'a'.repeat(NOTE_TAG_MAX_LENGTH - 1)} b`;
    expect(normalizeTags([tag])[0]).toBe('a'.repeat(NOTE_TAG_MAX_LENGTH - 1));
  });
});

describe('tag formatting', () => {
  it('formats tags for the form and for CSV', () => {
    expect(formatTagsInput(['a', 'b c'])).toBe('a, b c');
    expect(serializeTagsCsv(['a', 'b c'])).toBe('a;b c');
    expect(normalizeTags(formatTagsInput(['a', 'b c']))).toEqual(['a', 'b c']);
  });
});

describe('sanitizeWebUrl', () => {
  it('keeps http and https URLs', () => {
    expect(sanitizeWebUrl(' https://example.com/a?b=1 ')).toBe('https://example.com/a?b=1');
    expect(sanitizeWebUrl('http://example.com')).toBe('http://example.com/');
  });

  it.each([['javascript:alert(1)'], ['chrome://settings'], ['file:///etc/passwd'], ['nope'], [3]])(
    'rejects %j',
    (value) => {
      expect(sanitizeWebUrl(value)).toBeUndefined();
    },
  );
});

describe('displayHost', () => {
  it('shows the hostname without www', () => {
    expect(displayHost('https://www.example.com/path')).toBe('example.com');
    expect(displayHost('https://docs.example.com/path')).toBe('docs.example.com');
  });
});
