import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { CloseIcon, ErrorIcon, InfoIcon, WarningIcon } from './icons';

export type ToastType = 'default' | 'warning' | 'error';
/** How a toast went: timed out, dismissed with ×, its action taken, or pushed out by newer ones. */
export type ToastCloseReason = 'timeout' | 'dismiss' | 'action' | 'overflow';

export interface ToastOptions {
  type?: ToastType;
  action?: { label: string; onAction: () => void };
  /** Runs exactly once, however the toast goes. */
  onClose?: (reason: ToastCloseReason) => void;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
  closing: boolean;
}

export const TOAST_DURATION_MS = 3000;
/** Toasts with an action (Undo) stay longer, so there's time to take it. */
export const ACTION_TOAST_DURATION_MS = 6000;
export const TOAST_EXIT_MS = 300;
/** Older toasts fade further back with each newer one; past this many they're gone. */
const MAX_TOASTS = 4;

const ICONS = { default: InfoIcon, warning: WarningIcon, error: ErrorIcon };

export function useToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const items = useRef<ToastItem[]>([]);
  const nextId = useRef(0);

  const update = useCallback((next: ToastItem[]) => {
    items.current = next;
    setToasts(next);
  }, []);

  const close = useCallback(
    (id: number, reason: ToastCloseReason) => {
      const item = items.current.find((toast) => toast.id === id);
      if (!item || item.closing) return;
      update(items.current.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast)));
      item.onClose?.(reason);
      setTimeout(() => update(items.current.filter((toast) => toast.id !== id)), TOAST_EXIT_MS);
    },
    [update],
  );

  const toast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      nextId.current += 1;
      const item: ToastItem = { ...options, id: nextId.current, message, closing: false };
      update([...items.current, item]);
      const open = items.current.filter((toast) => !toast.closing);
      for (const old of open.slice(0, Math.max(0, open.length - MAX_TOASTS))) {
        close(old.id, 'overflow');
      }
    },
    [close, update],
  );

  return { toasts, toast, close };
}

export function Toaster({
  toasts,
  onClose,
}: {
  toasts: readonly ToastItem[];
  onClose: (id: number, reason: ToastCloseReason) => void;
}) {
  const open = toasts.filter((toast) => !toast.closing);
  return (
    // A zero-height host: toasts sit above the composer without moving anything.
    <div
      aria-live="polite"
      aria-label="Notifications"
      role="region"
      className="pointer-events-none relative z-20 h-0 overflow-visible"
    >
      {toasts.map((toast) => {
        const fromNewest = open.length - 1 - open.indexOf(toast);
        return (
          <Toast
            key={toast.id}
            toast={toast}
            stackIndex={toast.closing ? 0 : fromNewest}
            onClose={(reason) => onClose(toast.id, reason)}
          />
        );
      })}
    </div>
  );
}

function Toast({
  toast,
  stackIndex,
  onClose,
}: {
  toast: ToastItem;
  stackIndex: number;
  onClose: (reason: ToastCloseReason) => void;
}) {
  const [paused, setPaused] = useState(false);
  const duration = toast.action ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS;
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // The timer stops while the pointer or focus is on the toast, and restarts in full after.
  useEffect(() => {
    if (paused || toast.closing) return;
    const timer = setTimeout(() => close.current('timeout'), duration);
    return () => clearTimeout(timer);
  }, [paused, toast.closing, duration]);

  const Icon = ICONS[toast.type ?? 'default'];
  return (
    <div
      // The host is the live region; errors interrupt.
      role={toast.type === 'error' ? 'alert' : undefined}
      data-closing={toast.closing || undefined}
      style={{ '--stack-index': stackIndex } as CSSProperties}
      className="toast pointer-events-auto absolute right-3 bottom-3 flex min-h-10 w-fit max-w-[calc(100%-24px)] items-center gap-1 rounded-lg border border-accent bg-toast p-2 text-[1.1em] text-toast-fg"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <Icon />
      <span className="min-w-0">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="ml-1 rounded px-1.5 py-0.5 font-semibold text-(--grey-50) underline-offset-2 hover:bg-[color-mix(in_srgb,var(--grey-100)_10%,transparent)] hover:underline"
          onClick={() => {
            toast.action!.onAction();
            onClose('action');
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        className="ml-auto flex items-center justify-center rounded p-0.5 hover:bg-[color-mix(in_srgb,var(--grey-100)_10%,transparent)]"
        onClick={() => onClose('dismiss')}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
