import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { NOTE_TITLE_MAX_LENGTH } from '@/lib/constants';
import { ArrowUpIcon, TagIcon } from './icons';

export interface FormValues {
  title: string;
  content: string;
  /** The tags field's raw text, comma-separated. */
  tags: string;
}

export const EMPTY_FORM: FormValues = { title: '', content: '', tags: '' };

type FieldErrors = Partial<Record<'title' | 'content', string>>;

export function validateForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.title.trim()) errors.title = 'Add a title.';
  if (!values.content.trim()) errors.content = 'Write something in the note.';
  return errors;
}

/**
 * The composer at the bottom of the panel: adds a note, or edits one (`editing`). Ctrl/Cmd+Enter
 * saves from any field, Escape cancels an edit. Empty fields get a message instead of a silent
 * no-op, and the first one takes focus.
 */
export function NoteForm({
  values,
  onChange,
  editing,
  disabled,
  onSubmit,
  onCancelEdit,
}: {
  values: FormValues;
  onChange: (values: FormValues) => void;
  editing: boolean;
  disabled: boolean;
  onSubmit: (values: FormValues) => Promise<void> | void;
  onCancelEdit: () => void;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const ids = { title: useId(), content: useId(), tags: useId(), errors: useId() };

  const set = (field: keyof FormValues, value: string) => {
    onChange({ ...values, [field]: value });
    if (field in errors) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field as keyof FieldErrors];
        return next;
      });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    const found = validateForm(values);
    setErrors(found);
    if (found.title) return titleRef.current?.focus();
    if (found.content) return contentRef.current?.focus();
    await onSubmit(values);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    } else if (event.key === 'Escape' && editing) {
      event.preventDefault();
      setErrors({});
      onCancelEdit();
    }
  };

  const fieldFocus = 'focus-visible:outline-offset-[-2px]';
  const errorList = [errors.title, errors.content].filter(Boolean);

  return (
    <form
      noValidate
      aria-label={editing ? 'Edit note' : 'New note'}
      onSubmit={submit}
      onKeyDown={onKeyDown}
    >
      {editing && (
        <button
          type="button"
          disabled={disabled}
          className="ml-2 rounded-t-lg border border-b-0 border-accent px-2 py-1 text-xs text-hover-fg transition-colors duration-[180ms] hover:bg-hover"
          onClick={() => {
            setErrors({});
            onCancelEdit();
          }}
        >
          Cancel
        </button>
      )}
      <div className="flex items-center gap-2">
        <div className="mt-auto flex grow flex-col overflow-hidden rounded-lg border border-accent">
          <input
            ref={titleRef}
            id={ids.title}
            type="text"
            aria-label="Title"
            placeholder="Title"
            maxLength={NOTE_TITLE_MAX_LENGTH}
            value={values.title}
            disabled={disabled}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${ids.errors}-title` : undefined}
            onChange={(event) => set('title', event.target.value)}
            className={`min-h-lh rounded-lg bg-transparent p-3 text-[1.25em] leading-[1.4] font-bold ${fieldFocus}`}
          />
          <textarea
            ref={contentRef}
            id={ids.content}
            aria-label="Note"
            placeholder="Enter your note..."
            autoFocus
            value={values.content}
            disabled={disabled}
            aria-invalid={errors.content ? true : undefined}
            aria-describedby={errors.content ? `${ids.errors}-content` : undefined}
            onChange={(event) => set('content', event.target.value)}
            className={`max-h-[calc(3lh+24px)] min-h-lh grow resize-none overflow-y-auto rounded-lg border-t border-accent bg-transparent p-3 text-[1.15em] leading-[1.4] ${fieldFocus}`}
          />
          <div className="relative flex items-center border-t border-accent">
            <TagIcon className="pointer-events-none absolute left-3 text-secondary" />
            <input
              id={ids.tags}
              type="text"
              aria-label="Tags (comma-separated)"
              placeholder="Tags (comma-separated)"
              autoComplete="off"
              spellCheck={false}
              value={values.tags}
              disabled={disabled}
              onChange={(event) => set('tags', event.target.value)}
              className={`w-full rounded-lg bg-transparent py-2 pr-3 pl-9 text-[0.9em] placeholder:text-secondary ${fieldFocus}`}
            />
          </div>
        </div>
        <button
          type="submit"
          aria-label={editing ? 'Save changes' : 'Add note'}
          title={editing ? 'Save changes (Ctrl+Enter)' : 'Add note (Ctrl+Enter)'}
          disabled={disabled}
          className="h-10 rounded-[20px] bg-primary px-3 text-on-primary transition-[background-color,opacity,transform] duration-[180ms] hover:bg-primary-hover active:scale-[0.96] disabled:opacity-75 disabled:active:scale-100"
        >
          <ArrowUpIcon />
        </button>
      </div>
      {errorList.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5 px-1 text-sm text-error">
          {errors.title && <p id={`${ids.errors}-title`}>{errors.title}</p>}
          {errors.content && <p id={`${ids.errors}-content`}>{errors.content}</p>}
        </div>
      )}
    </form>
  );
}
