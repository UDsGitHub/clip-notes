import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A native modal <dialog>, shown while `open`. Escape and the dialog's own close() call
 * `onClose`; with `dismissible` false, Escape does nothing (the loader).
 */
export function Dialog({
  open,
  onClose,
  dismissible = true,
  className,
  children,
  ...aria
}: {
  open: boolean;
  onClose?: () => void;
  dismissible?: boolean;
  className?: string;
  children: ReactNode;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose?.();
      }}
      onClose={() => {
        if (open) onClose?.();
      }}
      {...aria}
    >
      {open && children}
    </dialog>
  );
}

export const dialogPanel =
  'm-auto w-[min(320px,calc(100%-24px))] max-w-[calc(100%-24px)] rounded-xl border border-line bg-surface p-4 text-fg';
