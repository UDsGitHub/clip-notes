/** True when a drag carries files (not text or a link). */
export function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}

/**
 * Stops Chrome from opening a file dropped anywhere but a `[data-dropzone]`: it would replace
 * the side panel with the file. Returns the uninstaller.
 */
export function guardFileDrops(target: Document = document): () => void {
  const guard = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    if (event.target instanceof Element && event.target.closest('[data-dropzone]')) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
  };
  target.addEventListener('dragover', guard);
  target.addEventListener('drop', guard);
  return () => {
    target.removeEventListener('dragover', guard);
    target.removeEventListener('drop', guard);
  };
}
