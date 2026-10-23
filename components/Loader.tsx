import { useState } from 'react';
import { LOADER_MIN_VISIBLE, LOADER_SHOW_DELAY } from '@/lib/constants';
import { Dialog } from './Dialog';

/**
 * Runs a slow task with the "Processing..." loader: shown only if the task takes longer than
 * LOADER_SHOW_DELAY, then kept up at least LOADER_MIN_VISIBLE so it doesn't flash.
 */
export function useLoader() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async <T,>(task: () => Promise<T>): Promise<T> => {
    setBusy(true);
    let shownAt = 0;
    const showTimer = setTimeout(() => {
      shownAt = Date.now();
      setVisible(true);
    }, LOADER_SHOW_DELAY);
    try {
      return await task();
    } finally {
      clearTimeout(showTimer);
      if (shownAt) {
        const remaining = LOADER_MIN_VISIBLE - (Date.now() - shownAt);
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
        setVisible(false);
      }
      setBusy(false);
    }
  };

  return { busy, visible, run };
}

export function Loader({ visible }: { visible: boolean }) {
  return (
    <Dialog
      open={visible}
      dismissible={false}
      aria-label="Processing"
      className="fixed top-1/4 left-1/2 m-0 h-16 w-32 -translate-x-1/2 items-center justify-center rounded-xl border border-accent bg-(--grey-800) text-(--grey-300) open:flex"
    >
      <svg className="h-12 w-12" viewBox="0 0 100 100" aria-hidden="true">
        <circle
          className="loader-arc"
          cx="50"
          cy="50"
          r="25"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="117.75 39.25"
          strokeLinecap="round"
        />
      </svg>
      <p>Processing...</p>
    </Dialog>
  );
}
