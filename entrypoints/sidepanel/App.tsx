import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeleteAllDialog } from '@/components/ConfirmDialog';
import { guardFileDrops } from '@/components/dropGuard';
import { ExportMenu } from '@/components/ExportMenu';
import { SearchField, TagFilterBar } from '@/components/Filters';
import { headerButton } from '@/components/headerButton';
import { ImportIcon, TrashIcon } from '@/components/icons';
import { ImportDialog } from '@/components/ImportDialog';
import { Loader, useLoader } from '@/components/Loader';
import { EMPTY_FORM, NoteForm, type FormValues } from '@/components/NoteForm';
import { NoteList, type Indicator } from '@/components/NoteList';
import { Toaster, useToaster } from '@/components/Toaster';
import { useNotes } from '@/components/useNotes';
import { exportNotes } from '@/lib/exportNotes';
import type { ImportFormat } from '@/lib/importNotes';
import {
  collectTags,
  isFiltering,
  noteMatchesFilters,
  sortNotes,
  type NoteFilters,
} from '@/lib/noteList';
import {
  addNote,
  applyMove,
  clearNotes,
  deleteNote,
  moveNote,
  NoteNotFoundError,
  restoreNote,
  setPinned,
  updateNote,
} from '@/lib/notes';
import { formatTagsInput, normalizeTags } from '@/lib/text';
import type { Note } from '@/lib/types';

/** How long a deleted card takes to fade out (the `note-exiting` animation). */
export const NOTE_EXIT_MS = 180;
/** How long a new card's `note-entering` animation runs. */
const NOTE_ENTER_MS = 250;

const NO_FILTERS: NoteFilters = { query: '', tag: null };

export default function App() {
  const [notes, setNotes] = useNotes();
  const [filters, setFilters] = useState<NoteFilters>(NO_FILTERS);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [formKey, setFormKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<Record<string, Indicator>>({});
  const [exitingIds, setExitingIds] = useState<ReadonlySet<string>>(new Set());
  const [enteringIds, setEnteringIds] = useState<ReadonlySet<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [announcement, setAnnouncement] = useState({ text: '', key: 0 });
  const { toasts, toast, close: closeToast } = useToaster();
  const loader = useLoader();
  const busy = loader.busy;
  const indicatorKey = useRef(0);
  const latestForm = useRef(form);
  useEffect(() => {
    latestForm.current = form;
  }, [form]);

  useEffect(() => guardFileDrops(), []);

  // Notes that appear after the first load (added here, clipped, imported, undone) slide in.
  const knownIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!notes) return;
    const ids = new Set(notes.map((note) => note.id));
    const previous = knownIds.current;
    knownIds.current = ids;
    if (!previous) return;
    const fresh = [...ids].filter((id) => !previous.has(id));
    if (fresh.length === 0) return;
    setEnteringIds(new Set(fresh));
    const timer = setTimeout(() => setEnteringIds(new Set()), NOTE_ENTER_MS);
    return () => clearTimeout(timer);
  }, [notes]);

  const sorted = useMemo(() => sortNotes(notes ?? []), [notes]);
  const tags = useMemo(() => collectTags(sorted), [sorted]);

  // The selected tag went out of use (its last note deleted or edited): back to All.
  if (
    filters.tag !== null &&
    notes !== null &&
    !tags.some((tag) => tag.toLowerCase() === filters.tag!.toLowerCase())
  ) {
    setFilters({ ...filters, tag: null });
  }

  const visible = sorted.filter((note) => noteMatchesFilters(note, filters));
  const pinned = visible.filter((note) => note.pinned);
  const unpinned = visible.filter((note) => !note.pinned);
  const hasNotes = sorted.length > 0;

  const announce = (text: string) => setAnnouncement(({ key }) => ({ text, key: key + 1 }));

  const showIndicator = (id: string, text: string) => {
    indicatorKey.current += 1;
    setIndicators((current) => ({ ...current, [id]: { text, key: indicatorKey.current } }));
    announce(text);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormKey((key) => key + 1);
  };

  const onSubmit = async (values: FormValues) => {
    const draft = {
      title: values.title.trim(),
      content: values.content.trim(),
      tags: normalizeTags(values.tags),
    };
    const savingId = editingId;
    // Clear at once, so whatever is typed next isn't wiped when the save finishes.
    resetForm();
    try {
      if (savingId) {
        try {
          await updateNote(savingId, draft);
          showIndicator(savingId, 'Updated');
        } catch (error) {
          if (!(error instanceof NoteNotFoundError)) throw error;
          // Deleted meanwhile (here or in another window): keep the text rather than lose it.
          await addNote(draft);
          toast('That note was deleted, so your changes were saved as a new note.', {
            type: 'warning',
          });
        }
      } else {
        await addNote(draft);
      }
    } catch (error) {
      console.error('Saving the note failed', error);
      toast('Couldn’t save the note. Try again.', { type: 'error' });
      // Hand the text back, unless something new has been typed since.
      const current = latestForm.current;
      if (!current.title && !current.content && !current.tags) {
        setForm(values);
        setEditingId(savingId);
        setFormKey((key) => key + 1);
      }
    }
  };

  const onCopy = async (note: Note) => {
    try {
      await navigator.clipboard.writeText(note.content);
      showIndicator(note.id, 'Copied');
    } catch (error) {
      console.error('Copying failed', error);
      toast('Couldn’t copy the note.', { type: 'error' });
    }
  };

  const onEdit = (note: Note) => {
    setEditingId(note.id);
    setForm({ title: note.title, content: note.content, tags: formatTagsInput(note.tags) });
    setFormKey((key) => key + 1);
  };

  const onTogglePin = async (note: Note) => {
    try {
      await setPinned(note.id, !note.pinned);
    } catch (error) {
      if (!(error instanceof NoteNotFoundError)) {
        console.error('Pinning failed', error);
        toast('Couldn’t update the note.', { type: 'error' });
      }
    }
  };

  const onDelete = async (note: Note) => {
    if (exitingIds.has(note.id)) return;
    setExitingIds((current) => new Set(current).add(note.id));
    await new Promise((resolve) => setTimeout(resolve, NOTE_EXIT_MS));
    try {
      const removed = await deleteNote(note.id);
      if (removed) {
        toast('Note deleted.', {
          action: {
            label: 'Undo',
            onAction: () => {
              restoreNote(removed).catch((error: unknown) => {
                console.error('Undo failed', error);
                toast('Couldn’t restore the note.', { type: 'error' });
              });
            },
          },
        });
      }
    } catch (error) {
      console.error('Deleting failed', error);
      toast('Couldn’t delete the note.', { type: 'error' });
    } finally {
      setExitingIds((current) => {
        const next = new Set(current);
        next.delete(note.id);
        return next;
      });
    }
  };

  const onMove = (id: string, overId: string) => {
    // Show the drop at once; the storage write confirms it a moment later.
    setNotes((current) => (current ? applyMove(current, id, overId) : current));
    moveNote(id, overId).catch((error: unknown) => {
      console.error('Reordering failed', error);
      toast('Couldn’t save the new order.', { type: 'error' });
    });
  };

  const onSearch = useCallback((query: string) => setFilters((f) => ({ ...f, query })), []);

  const onExport = async (format: ImportFormat) => {
    try {
      await loader.run(() => exportNotes(format));
      toast(`${format.toUpperCase()} downloaded.`);
    } catch (error) {
      console.error('Export failed', error);
      toast(`Couldn’t export ${format.toUpperCase()}.`, { type: 'error' });
    }
  };

  const onDeleteAll = async () => {
    setDeleteAllOpen(false);
    try {
      await loader.run(clearNotes);
      setFilters(NO_FILTERS);
      resetForm();
      toast('All notes deleted.');
    } catch (error) {
      console.error('Delete all failed', error);
      toast('Couldn’t delete the notes.', { type: 'error' });
    }
  };

  return (
    <div className="flex h-full flex-col px-2 py-3">
      <header className="mb-3.5 flex items-center justify-between">
        <h1 className="text-[1.5em] font-bold">Notes</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Import notes"
            title="Import"
            disabled={busy}
            className={headerButton}
            onClick={() => setImportOpen(true)}
          >
            <ImportIcon />
          </button>
          <ExportMenu disabled={busy} onExport={onExport} />
          <button
            type="button"
            aria-label="Delete all notes"
            title="Delete all notes"
            disabled={busy || !hasNotes}
            className={headerButton}
            onClick={() => setDeleteAllOpen(true)}
          >
            <TrashIcon />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 grow flex-col gap-2">
        <SearchField value={filters.query} disabled={busy} onSearch={onSearch} />
        <TagFilterBar
          tags={tags}
          selected={filters.tag}
          disabled={busy}
          onSelect={(tag) => setFilters((f) => ({ ...f, tag }))}
        />

        <div
          data-scroll-area
          aria-label="Notes list"
          role="region"
          className="relative min-h-0 grow overflow-y-auto pt-1"
          aria-busy={notes === null}
        >
          {notes !== null && !hasNotes && (
            <p className="flex items-center justify-center text-center text-fg">
              No notes yet. Add one below.
            </p>
          )}
          {hasNotes && visible.length === 0 && (
            <p className="px-3 py-6 text-center text-secondary">No notes match your filters.</p>
          )}
          {visible.length > 0 && (
            <NoteList
              pinned={pinned}
              unpinned={unpinned}
              reorderable={!isFiltering(filters) && !busy}
              editingId={editingId}
              enteringIds={enteringIds}
              exitingIds={exitingIds}
              indicators={indicators}
              onCopy={onCopy}
              onEdit={onEdit}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
              onTagClick={(tag) => setFilters((f) => ({ ...f, tag }))}
              onMove={onMove}
            />
          )}
        </div>

        <Toaster toasts={toasts} onClose={closeToast} />
        <NoteForm
          key={formKey}
          values={form}
          onChange={setForm}
          editing={editingId !== null}
          disabled={busy}
          onSubmit={onSubmit}
          onCancelEdit={resetForm}
        />
      </main>

      <div role="status" className="sr-only">
        <span key={announcement.key}>{announcement.text}</span>
      </div>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onResult={(message, type) => toast(message, { type })}
      />
      <DeleteAllDialog
        open={deleteAllOpen}
        onCancel={() => setDeleteAllOpen(false)}
        onConfirm={onDeleteAll}
      />
      <Loader visible={loader.visible} />
    </div>
  );
}
