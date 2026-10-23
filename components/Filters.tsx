import { useEffect, useId, useState } from 'react';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import { SearchIcon } from './icons';

/** The search box. `onSearch` runs once typing pauses for SEARCH_DEBOUNCE_MS. */
export function SearchField({
  value,
  disabled,
  onSearch,
}: {
  /** The applied query; changing it from outside (Delete all) replaces the box's text. */
  value: string;
  disabled: boolean;
  onSearch: (query: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const [applied, setApplied] = useState(value);
  if (value !== applied) {
    setApplied(value);
    setText(value);
  }

  useEffect(() => {
    if (text === applied) return;
    const timer = setTimeout(() => onSearch(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, applied, onSearch]);

  return (
    <div className="shrink-0 px-1">
      <label htmlFor={id} className="sr-only">
        Search notes
      </label>
      <div className="relative flex items-center">
        <SearchIcon className="pointer-events-none absolute left-2.5 text-secondary" />
        <input
          id={id}
          type="search"
          placeholder="Search notes…"
          autoComplete="off"
          spellCheck={false}
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          className="w-full rounded-lg border border-line bg-surface py-2 pr-3 pl-[34px] text-[0.95em] text-fg placeholder:text-secondary"
        />
      </div>
    </div>
  );
}

/** The tag chips: All plus every tag in use. Picking the selected chip again goes back to All. */
export function TagFilterBar({
  tags,
  selected,
  disabled,
  onSelect,
}: {
  tags: readonly string[];
  selected: string | null;
  disabled: boolean;
  onSelect: (tag: string | null) => void;
}) {
  if (tags.length === 0) return null;
  const isSelected = (tag: string | null) =>
    tag === null ? selected === null : selected?.toLowerCase() === tag.toLowerCase();

  const chip = (tag: string | null, label: string) => (
    <button
      key={tag ?? ''}
      type="button"
      aria-pressed={isSelected(tag)}
      disabled={disabled}
      onClick={() => onSelect(tag === null || isSelected(tag) ? null : tag)}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.8rem] leading-[1.4] whitespace-nowrap ${
        isSelected(tag)
          ? 'border-primary bg-primary text-on-primary hover:border-primary-hover hover:bg-primary-hover'
          : 'border-line bg-surface text-secondary hover:border-line-strong hover:text-hover-fg'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="shrink-0 px-1">
      <div
        role="group"
        aria-label="Filter by tag"
        className="scrollbar-none flex gap-2 overflow-x-auto p-0.5"
      >
        {chip(null, 'All')}
        {tags.map((tag) => chip(tag, tag))}
      </div>
    </div>
  );
}
