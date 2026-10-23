import { carriesFiles, guardFileDrops } from '@/components/dropGuard';

function dragEvent(type: string, types: string[]) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: { types, dropEffect: 'move' } });
  return event;
}

describe('guardFileDrops', () => {
  let uninstall: () => void;
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="outside"></div><label data-dropzone><span id="inside"></span></label>';
    uninstall = guardFileDrops();
  });
  afterEach(() => uninstall());

  it('refuses a file dropped outside a drop zone, so Chrome never opens it over the panel', () => {
    const event = dragEvent('drop', ['Files']);
    document.getElementById('outside')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(event.dataTransfer!.dropEffect).toBe('none');
  });

  it('leaves drops inside a drop zone to it', () => {
    const event = dragEvent('dragover', ['Files']);
    document.getElementById('inside')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves text drags alone (dropping text into a field still works)', () => {
    const event = dragEvent('drop', ['text/plain']);
    document.getElementById('outside')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops guarding once uninstalled', () => {
    uninstall();
    const event = dragEvent('drop', ['Files']);
    document.getElementById('outside')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    uninstall = () => {};
  });

  it('carriesFiles reads the drag types', () => {
    expect(carriesFiles(dragEvent('dragover', ['Files', 'text/uri-list']))).toBe(true);
    expect(carriesFiles(dragEvent('dragover', ['text/plain']))).toBe(false);
  });
});
