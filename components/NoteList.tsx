import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { NOTE_BODY_MAX_DISPLAY_LENGTH, NOTE_TITLE_MAX_LENGTH } from '@/lib/constants';
import { dateFormatter, displayHost, truncateText } from '@/lib/text';
import type { Note } from '@/lib/types';
import { DeleteIcon, EditIcon, GripIcon, PinIcon, UnpinIcon } from './icons';

/** A short-lived badge under a card: "Copied" or "Updated". `key` restarts its animation. */
export interface Indicator {
  text: string;
  key: number;
}

export interface NoteCardHandlers {
  onCopy: (note: Note) => void;
  onEdit: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTagClick: (tag: string) => void;
}

interface NoteListProps extends NoteCardHandlers {
  pinned: readonly Note[];
  unpinned: readonly Note[];
  /** Drag to reorder is off while a search or tag filter shows only some notes. */
  reorderable: boolean;
  editingId: string | null;
  enteringIds: ReadonlySet<string>;
  exitingIds: ReadonlySet<string>;
  indicators: Readonly<Record<string, Indicator>>;
  onMove: (id: string, overId: string) => void;
}

export function NoteList({ pinned, unpinned, onMove, ...card }: NoteListProps) {
  return (
    <div className="flex flex-col gap-2">
      {pinned.length > 0 && (
        <>
          <section aria-labelledby="pinned-label">
            <h2
              id="pinned-label"
              className="pt-2 pr-6 pl-3 text-xs font-semibold tracking-[0.04em] text-section-label uppercase"
            >
              Pinned
            </h2>
            <SortableSection
              label="Pinned notes"
              notes={pinned}
              onMove={onMove}
              className="pb-2"
              {...card}
            />
          </section>
          <div aria-hidden="true" className="py-2 pr-6 pl-3">
            <div className="mx-auto w-[90%] border-t border-accent" />
          </div>
        </>
      )}
      {unpinned.length > 0 && (
        <section aria-label={pinned.length > 0 ? 'Other notes' : undefined}>
          <SortableSection
            label={pinned.length > 0 ? 'Other notes' : 'Notes'}
            notes={unpinned}
            onMove={onMove}
            className="pb-6"
            {...card}
          />
        </section>
      )}
    </div>
  );
}

/** Cards only ever move up and down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function SortableSection({
  label,
  notes,
  onMove,
  className,
  ...card
}: Omit<NoteListProps, 'pinned' | 'unpinned'> & {
  label: string;
  notes: readonly Note[];
  className: string;
}) {
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on the handle stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const titleOf = (id: string | number) =>
    notes.find((note) => note.id === id)?.title ?? 'the note';
  const position = (id: string | number) => notes.findIndex((note) => note.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${titleOf(active.id)}. Position ${position(active.id)} of ${notes.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)} moved to position ${position(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${titleOf(active.id)} at position ${position(over.id)}.`
        : `Dropped ${titleOf(active.id)}.`,
    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To reorder, press Space or Enter to pick the note up, the arrow keys to move it, Space or Enter to drop it, or Escape to cancel.',
        },
      }}
    >
      <SortableContext
        items={notes.map((note) => note.id)}
        strategy={verticalListSortingStrategy}
        disabled={!card.reorderable}
      >
        <ul aria-label={label} className={`flex flex-col gap-5 pt-2 pr-6 pl-3 ${className}`}>
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} {...card} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/** Clicks on these inside a card do their own thing instead of copying the note. */
const OWN_CLICK = 'button, a, input, textarea';

function NoteCard({
  note,
  reorderable,
  editingId,
  enteringIds,
  exitingIds,
  indicators,
  onCopy,
  onEdit,
  onTogglePin,
  onDelete,
  onTagClick,
}: Omit<NoteListProps, 'pinned' | 'unpinned' | 'onMove'> & { note: Note }) {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const body = truncateText(note.content, NOTE_BODY_MAX_DISPLAY_LENGTH);
  const truncated = body !== note.content;
  const title = truncateText(note.title, NOTE_TITLE_MAX_LENGTH);
  const indicator = indicators[note.id];
  const date = dateFormatter.format(new Date(note.updatedAt ?? note.createdAt));

  const onCardClick = (event: MouseEvent) => {
    if ((event.target as Element).closest(OWN_CLICK)) return;
    onCopy(note);
  };

  const classes = [
    'relative flex min-h-12 shrink-0 items-center gap-1 rounded-xl border border-accent p-2 transition-colors hover:bg-hover',
    editingId === note.id ? 'bg-hover outline-4 outline-editing' : '',
    isDragging ? 'z-10 cursor-grabbing bg-hover' : 'cursor-pointer',
    enteringIds.has(note.id) ? 'note-entering' : '',
    exitingIds.has(note.id) ? 'note-exiting' : '',
  ];

  return (
    <li
      ref={setNodeRef}
      data-note-id={note.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={classes.join(' ')}
      onClick={onCardClick}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${note.title}`}
        title={reorderable ? 'Drag to reorder' : 'Clear search and filters to reorder'}
        disabled={!reorderable}
        className="shrink-0 cursor-grab touch-none px-0.5 text-fg hover:text-hover-fg active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GripIcon />
      </button>

      <div className="min-w-0 grow">
        <button
          type="button"
          title="Click to copy"
          className="block w-full cursor-pointer text-left"
          onClick={() => onCopy(note)}
        >
          <span title={note.title} className="block py-[0.5em] text-[1.25em] font-bold break-words">
            {title}
          </span>
          <span className="whitespace-pre-wrap text-fg [overflow-wrap:anywhere]">
            {expanded ? note.content : body}
          </span>
        </button>
        {truncated && (
          <button
            type="button"
            aria-expanded={expanded}
            className="inline-flex min-h-6 items-center text-[0.95em] hover:underline"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'show less' : 'show more'}
          </button>
        )}
        {note.tags.length > 0 && (
          <ul aria-label="Tags" className="mt-1.5 flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  title={`Filter by ${tag}`}
                  aria-label={`Filter by tag ${tag}`}
                  className="rounded-full border border-line bg-surface-muted px-2 py-0.5 text-xs leading-[1.4] text-secondary hover:border-line-strong hover:text-hover-fg"
                  onClick={() => onTagClick(tag)}
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        )}
        <span className="mt-[0.5em] block text-secondary">
          {date}
          {note.url && (
            <>
              {' · '}
              <a
                href={note.url}
                target="_blank"
                rel="noreferrer"
                title={note.url}
                className="underline-offset-2 hover:text-hover-fg hover:underline"
              >
                {displayHost(note.url)}
              </a>
            </>
          )}
        </span>
      </div>

      <ActionButton
        label={`${note.pinned ? 'Unpin' : 'Pin'} ${note.title}`}
        title={note.pinned ? 'Unpin note' : 'Pin note'}
        className={note.pinned ? 'text-accent' : ''}
        onClick={() => onTogglePin(note)}
      >
        {note.pinned ? <UnpinIcon /> : <PinIcon />}
      </ActionButton>
      <ActionButton label={`Edit ${note.title}`} title="Edit note" onClick={() => onEdit(note)}>
        <EditIcon />
      </ActionButton>
      <ActionButton
        label={`Delete ${note.title}`}
        title="Delete note"
        onClick={() => onDelete(note)}
      >
        <DeleteIcon />
      </ActionButton>

      {indicator && (
        <span
          key={indicator.key}
          aria-hidden="true"
          data-visible=""
          className="note-indicator pointer-events-none absolute bottom-[-22px] left-0 z-[2] flex h-5 items-center rounded-md bg-page-inverse px-[0.4rem] text-[0.95em] text-fg-inverse"
        >
          {indicator.text}
        </span>
      )}
    </li>
  );
}

function ActionButton({
  label,
  title,
  className = '',
  onClick,
  children,
}: {
  label: string;
  title: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      className={`shrink-0 px-0.5 text-fg hover:text-hover-fg ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
