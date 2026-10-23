import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { LOADER_MIN_VISIBLE } from '@/lib/constants';
import { parseNotes, type ImportFormat } from '@/lib/importNotes';
import { importNotes } from '@/lib/notes';
import { Dialog, dialogPanel } from './Dialog';
import { carriesFiles } from './dropGuard';
import { ChevronIcon } from './icons';

const PLACEHOLDERS: Record<ImportFormat, string> = {
  json: '[{"id":"...","title":"...","content":"...","createdAt":"...","order":0,"pinned":false,"tags":["work"]}]',
  csv: 'id,title,content,createdAt,updatedAt,order,pinned,tags,url',
};

const EXAMPLES: Record<ImportFormat, string> = {
  json: `[
  {
    "id": "note-…",
    "title": "Title",
    "content": "Note body",
    "createdAt": "2026-09-10T12:00:00.000Z",
    "updatedAt": "2026-09-16T12:00:00.000Z",
    "order": 1,
    "pinned": false,
    "tags": ["work", "ideas"],
    "url": "https://example.com/article"
  }
]`,
  csv: `id,title,content,createdAt,updatedAt,order,pinned,tags,url
"note-…","Title","Note body","2026-09-10T12:00:00.000Z","",1,false,"work;ideas",""`,
};

/** How long "Imported" shows on the button before the dialog closes. */
export const IMPORT_SUCCESS_CLOSE_MS = 600;

export function importResultMessage(imported: number, skipped: number): string {
  const notes = (count: number) => `${count} ${count === 1 ? 'note' : 'notes'}`;
  if (imported > 0 && skipped > 0) {
    return `Imported ${notes(imported)}. Skipped ${skipped} that already exist.`;
  }
  if (imported > 0) return `Imported ${notes(imported)}.`;
  return `No notes imported. ${skipped === 1 ? '1 already exists' : `${skipped} already exist`}.`;
}

type ButtonState = 'default' | 'loading' | 'error' | 'success';

/**
 * Import from a .json/.csv file (picked or dropped) or pasted text. A file wins over pasted
 * text. Notes whose id already exists are skipped. Errors show in the dialog; results as a toast.
 */
export function ImportDialog({
  open,
  onClose,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  onResult: (message: string, type: 'default' | 'warning') => void;
}) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      className={`${dialogPanel} w-[min(360px,calc(100%-24px))] overflow-x-hidden`}
    >
      <ImportForm titleId={titleId} onClose={onClose} onResult={onResult} />
    </Dialog>
  );
}

function ImportForm({
  titleId,
  onClose,
  onResult,
}: {
  titleId: string;
  onClose: () => void;
  onResult: (message: string, type: 'default' | 'warning') => void;
}) {
  const ids = { file: useId(), fileLabel: useId(), text: useId(), error: useId() };
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFormat>('json');
  const [text, setText] = useState('');
  const [state, setState] = useState<ButtonState>('default');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const reset = () => {
    setState('default');
    setError('');
  };

  const pickFile = (picked: File | null) => {
    setFile(picked);
    reset();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (state === 'loading') return;
    const dropped = event.dataTransfer.files;
    if (dropped.length !== 1) {
      setState('error');
      setError('Drop one file at a time.');
      return;
    }
    // Mirror it into the input so the form shows one source of truth.
    const transfer = new DataTransfer();
    transfer.items.add(dropped[0]!);
    if (fileInput.current) fileInput.current.files = transfer.files;
    pickFile(dropped[0]!);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (state === 'loading' || state === 'success') return;
    setState('loading');
    setError('');
    const startedAt = Date.now();
    const settle = async () => {
      const remaining = LOADER_MIN_VISIBLE - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    };

    try {
      const notes = file
        ? parseNotes(await file.text(), { filename: file.name })
        : parseNotes(text, { format });
      const { imported, skipped } = await importNotes(notes);
      await settle();
      if (imported > 0) {
        setState('success');
        onResult(importResultMessage(imported, skipped), 'default');
        closeTimer.current = setTimeout(onClose, IMPORT_SUCCESS_CLOSE_MS);
      } else {
        setState('default');
        onResult(importResultMessage(imported, skipped), 'warning');
      }
    } catch (caught) {
      await settle();
      setState('error');
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    }
  };

  const submitLabel = {
    default: 'Import',
    loading: 'Importing…',
    error: 'Import',
    success: 'Imported',
  }[state];
  const submitColor = {
    default: 'bg-primary text-on-primary hover:enabled:bg-primary-hover',
    loading: 'bg-primary text-on-primary',
    error: 'bg-[oklch(80.8%_0.114_19.571)] text-(--grey-950)',
    success: 'bg-[oklch(87.1%_0.15_154.449)] text-(--grey-950)',
  }[state];

  return (
    <form className="flex min-w-0 flex-col gap-3" onSubmit={submit}>
      <h2 id={titleId} className="text-[1.1rem] font-bold text-hover-fg">
        Import notes
      </h2>

      <label
        data-dropzone
        htmlFor={ids.file}
        onDragEnter={(event) => carriesFiles(event.nativeEvent) && setDragOver(true)}
        onDragOver={(event) => {
          if (!carriesFiles(event.nativeEvent)) return;
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragOver(false);
        }}
        onDrop={onDrop}
        className={`relative flex min-h-22 items-center justify-center rounded-lg border p-4 text-center transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-outline ${
          dragOver
            ? 'border-dashed border-hover-fg bg-hover text-hover-fg'
            : file
              ? 'border-solid border-line-strong bg-[color-mix(in_srgb,var(--surface-muted)_70%,transparent)] text-fg'
              : 'border-dashed border-line-strong bg-[color-mix(in_srgb,var(--surface-muted)_70%,transparent)] text-secondary hover:border-outline hover:text-hover-fg'
        }`}
      >
        <input
          ref={fileInput}
          id={ids.file}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          aria-describedby={ids.fileLabel}
          className="sr-only"
          disabled={state === 'loading'}
          onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
        />
        <span id={ids.fileLabel} className="text-[0.85rem] [overflow-wrap:anywhere]">
          {file ? file.name : 'Drop a .json or .csv file here, or click to browse'}
        </span>
      </label>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-0.5 text-[0.85rem] text-secondary">Or paste</legend>
        <div
          role="radiogroup"
          aria-label="Paste format"
          className="format-switch relative mt-1 grid w-fit min-w-16 grid-cols-2 rounded-full border border-line bg-surface-muted p-0.5"
        >
          {(['json', 'csv'] as const).map((value) => (
            <label key={value} className="relative z-[1] flex">
              <input
                type="radio"
                name="import-format"
                value={value}
                checked={format === value}
                onChange={() => {
                  setFormat(value);
                  reset();
                }}
                className="peer absolute inset-0 m-0 opacity-0"
              />
              <span className="flex-1 rounded-full px-1.5 py-1 text-center text-[0.72rem] font-medium text-secondary transition-colors duration-[180ms] select-none peer-checked:text-on-primary peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-outline">
                {value.toUpperCase()}
              </span>
            </label>
          ))}
        </div>
        <details className="format-example min-w-0">
          <summary className="inline-flex list-none items-center gap-1 text-[0.8rem] text-secondary transition-colors select-none hover:text-hover-fg [&::-webkit-details-marker]:hidden">
            <ChevronIcon className="!h-3.5 !w-3.5 transition-transform duration-[180ms] [details[open]>summary>&]:rotate-90" />
            Expected format
          </summary>
          {/* Focusable so its sideways scroll works from the keyboard. */}
          <pre
            tabIndex={0}
            aria-label={`Example ${format.toUpperCase()}`}
            className="mt-1.5 max-w-full min-w-0 overflow-x-auto rounded-lg bg-page p-2 font-mono text-[0.72rem] leading-[1.45] whitespace-pre text-fg"
          >
            {EXAMPLES[format]}
          </pre>
        </details>
        <label htmlFor={ids.text} className="sr-only">
          Notes to import
        </label>
        <textarea
          id={ids.text}
          rows={6}
          placeholder={PLACEHOLDERS[format]}
          value={text}
          disabled={state === 'loading'}
          onChange={(event) => {
            setText(event.target.value);
            reset();
          }}
          className="min-h-24 resize-y rounded-lg border border-line bg-page p-2 text-fg"
        />
      </fieldset>

      {error && (
        <p id={ids.error} role="alert" className="text-[0.85rem] text-error">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded-lg px-3 py-2 font-medium text-fg hover:bg-hover"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={state === 'loading'}
          aria-describedby={error ? ids.error : undefined}
          className={`rounded-lg px-3 py-2 font-medium transition-[background-color,color,opacity,transform] duration-[180ms] active:enabled:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 ${submitColor}`}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
