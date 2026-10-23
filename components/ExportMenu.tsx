import { useRef } from 'react';
import type { ImportFormat } from '@/lib/importNotes';
import { ExportIcon } from './icons';
import { headerButton } from './headerButton';

const MENU_ID = 'export-menu';

/** The header's export button and its CSV/JSON menu (a native popover, light-dismissed). */
export function ExportMenu({
  disabled,
  onExport,
}: {
  disabled: boolean;
  onExport: (format: ImportFormat) => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const choose = (format: ImportFormat) => {
    menu.current?.hidePopover();
    onExport(format);
  };
  const item =
    'block w-full rounded-lg p-2 text-left transition-colors duration-300 hover:bg-hover focus-visible:bg-hover';

  return (
    <>
      <button
        type="button"
        popovertarget={MENU_ID}
        aria-label="Export notes"
        title="Export"
        disabled={disabled}
        className={`${headerButton} [anchor-name:--export-button]`}
      >
        <ExportIcon />
      </button>
      <div
        ref={menu}
        id={MENU_ID}
        popover="auto"
        className="export-menu m-0 min-w-32 rounded-lg border border-line bg-surface p-1 text-fg [position-anchor:--export-button]"
      >
        <button type="button" className={item} onClick={() => choose('csv')}>
          Export as CSV
        </button>
        <button type="button" className={item} onClick={() => choose('json')}>
          Export as JSON
        </button>
      </div>
    </>
  );
}
