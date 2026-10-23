/**
 * Saves a Blob as a download from an extension page: a link with `download`, clicked. Needs no
 * `downloads` permission.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // The download has started from the click; give the browser a moment before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
