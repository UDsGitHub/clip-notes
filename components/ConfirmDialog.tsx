import { useId } from 'react';
import { Dialog, dialogPanel } from './Dialog';

export function DeleteAllDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      className={dialogPanel}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <h2 id={titleId} className="text-[1.1rem] font-bold text-hover-fg">
          Delete all notes?
        </h2>
        <p id={bodyId} className="text-[0.95rem] leading-[1.45] text-secondary">
          This permanently removes every note from this device. This can’t be undone.
        </p>
        <div className="flex justify-end gap-2">
          {/* Focused first: the safe choice. */}
          <button
            type="button"
            autoFocus
            className="rounded-lg border border-line px-3 py-2 text-fg hover:bg-hover"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-danger px-3 py-2 text-white hover:bg-danger-hover"
          >
            Delete all
          </button>
        </div>
      </form>
    </Dialog>
  );
}
