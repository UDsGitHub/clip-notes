import {
  collectTags,
  isFiltering,
  maxOrder,
  noteHasTag,
  noteMatchesFilters,
  noteMatchesQuery,
  sortNotes,
} from './noteList';
import type { Note } from './types';

const note = (id: string, overrides: Partial<Note> = {}): Note => ({
  id,
  title: id,
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  order: 0,
  pinned: false,
  ...overrides,
});

describe('sortNotes', () => {
  it('puts pinned notes first, then higher order first', () => {
    const sorted = sortNotes([
      note('a', { order: 0 }),
      note('b', { order: 5, pinned: true }),
      note('c', { order: 2 }),
      note('d', { order: 1, pinned: true }),
    ]);
    expect(sorted.map((n) => n.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('breaks order ties by the newest edit', () => {
    const sorted = sortNotes([
      note('old', { createdAt: '2026-01-01T00:00:00.000Z' }),
      note('edited', {
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      }),
    ]);
    expect(sorted.map((n) => n.id)).toEqual(['edited', 'old']);
  });

  it('does not change its input', () => {
    const input = [note('a', { order: 0 }), note('b', { order: 1 })];
    sortNotes(input);
    expect(input.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('maxOrder', () => {
  it('is per section, and -1 for an empty one', () => {
    const notes = [note('a', { order: 3 }), note('b', { order: 9, pinned: true })];
    expect(maxOrder(notes, false)).toBe(3);
    expect(maxOrder(notes, true)).toBe(9);
    expect(maxOrder([], false)).toBe(-1);
  });
});

describe('filters', () => {
  const recipe = note('r', { title: 'Pasta night', content: 'Garlic', tags: ['Recipes'] });

  it('matches the query in the title, body or a tag, ignoring case', () => {
    expect(noteMatchesQuery(recipe, 'PASTA')).toBe(true);
    expect(noteMatchesQuery(recipe, 'garl')).toBe(true);
    expect(noteMatchesQuery(recipe, 'recip')).toBe(true);
    expect(noteMatchesQuery(recipe, 'soup')).toBe(false);
    expect(noteMatchesQuery(recipe, '   ')).toBe(true);
  });

  it('matches a tag exactly, ignoring case', () => {
    expect(noteHasTag(recipe, 'recipes')).toBe(true);
    expect(noteHasTag(recipe, 'recipe')).toBe(false);
    expect(noteHasTag(recipe, null)).toBe(true);
  });

  it('applies the tag first, then the query within it', () => {
    expect(noteMatchesFilters(recipe, { query: 'garlic', tag: 'recipes' })).toBe(true);
    expect(noteMatchesFilters(recipe, { query: 'garlic', tag: 'work' })).toBe(false);
    expect(noteMatchesFilters(recipe, { query: 'soup', tag: 'recipes' })).toBe(false);
  });

  it('knows when anything is filtered', () => {
    expect(isFiltering({ query: '', tag: null })).toBe(false);
    expect(isFiltering({ query: '  ', tag: null })).toBe(false);
    expect(isFiltering({ query: 'a', tag: null })).toBe(true);
    expect(isFiltering({ query: '', tag: 'x' })).toBe(true);
  });
});

describe('collectTags', () => {
  it('dedupes case-insensitively and sorts A–Z ignoring case', () => {
    const tags = collectTags([
      note('a', { tags: ['work', 'Ideas'] }),
      note('b', { tags: ['ideas', 'apple', 'Work'] }),
    ]);
    expect(tags).toEqual(['apple', 'Ideas', 'work']);
  });
});
