import type { Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import background, { handleClip } from '../entrypoints/background';
import { CLIP_MENU_ID, CLIP_MENU_TITLE } from '@/lib/constants';
import { readNotes } from '@/lib/notes';

type Listener = (...args: never[]) => unknown;

function fakeEvent<L extends Listener>() {
  const listeners: L[] = [];
  return {
    listeners,
    addListener: vi.fn((l: L) => void listeners.push(l)),
    fire: (...args: Parameters<L>) => listeners.forEach((l) => l(...args)),
  };
}

const tab = (overrides: Partial<Browser.tabs.Tab> = {}) =>
  ({
    id: 7,
    windowId: 3,
    title: 'An article',
    url: 'https://example.com/article',
    ...overrides,
  }) as Browser.tabs.Tab;

const mocked = ['sidePanel', 'contextMenus'] as const;
const originals = Object.fromEntries(mocked.map((k) => [k, fakeBrowser[k]]));

function installMocks() {
  const sidePanel = {
    setPanelBehavior: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
  };
  const contextMenus = {
    create: vi.fn(),
    removeAll: vi.fn().mockResolvedValue(undefined),
    onClicked:
      fakeEvent<
        (info: Partial<Browser.contextMenus.OnClickData>, tab?: Browser.tabs.Tab) => void
      >(),
  };
  Object.assign(fakeBrowser, { sidePanel, contextMenus });
  return { sidePanel, contextMenus };
}

let api: ReturnType<typeof installMocks>;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fakeBrowser.reset();
  api = installMocks();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(fakeBrowser, originals);
});

describe('background startup', () => {
  it('makes the toolbar icon open the side panel', () => {
    background.main();
    expect(api.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });

  it('logs instead of throwing when setPanelBehavior rejects', async () => {
    const error = new Error('boom');
    api.sidePanel.setPanelBehavior.mockRejectedValue(error);
    expect(() => background.main()).not.toThrow();
    await vi.waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('setPanelBehavior failed', error),
    );
  });

  it('registers the click listener synchronously, so it survives a worker restart', () => {
    background.main();
    expect(api.contextMenus.onClicked.listeners).toHaveLength(1);
  });

  it('creates the menu on install or update, clearing old ones first (1.0 hit duplicate ids)', async () => {
    background.main();
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update' } as never);
    await vi.waitFor(() => expect(api.contextMenus.create).toHaveBeenCalledOnce());
    expect(api.contextMenus.removeAll.mock.invocationCallOrder[0]).toBeLessThan(
      api.contextMenus.create.mock.invocationCallOrder[0]!,
    );
    expect(api.contextMenus.create).toHaveBeenCalledWith(
      { id: CLIP_MENU_ID, title: CLIP_MENU_TITLE, contexts: ['selection'] },
      expect.any(Function),
    );
  });

  it('does not create the menu on a plain worker restart', () => {
    background.main();
    expect(api.contextMenus.create).not.toHaveBeenCalled();
  });
});

describe('Save to Notes', () => {
  beforeEach(() => background.main());

  it('opens the panel synchronously inside the click, before anything is awaited (1.0 awaited first)', () => {
    api.contextMenus.onClicked.fire({ menuItemId: CLIP_MENU_ID, selectionText: 'hello' }, tab());
    expect(api.sidePanel.open).toHaveBeenCalledWith({ windowId: 3 });
  });

  it('saves the selection as a note titled after the page, with its URL', async () => {
    api.contextMenus.onClicked.fire(
      { menuItemId: CLIP_MENU_ID, selectionText: '  some text  ' },
      tab(),
    );
    await vi.waitFor(async () =>
      expect(await readNotes()).toEqual([
        expect.objectContaining({
          title: 'An article',
          content: 'some text',
          url: 'https://example.com/article',
        }),
      ]),
    );
  });

  it('saves every clip made in quick succession', async () => {
    await Promise.all([
      handleClip('one', tab()),
      handleClip('two', tab()),
      handleClip('three', tab()),
    ]);
    expect(await readNotes()).toHaveLength(3);
  });

  it('ignores other menu ids and empty selections', async () => {
    api.contextMenus.onClicked.fire({ menuItemId: 'other', selectionText: 'x' }, tab());
    await handleClip('   ', tab());
    await handleClip(undefined, tab());
    expect(api.sidePanel.open).not.toHaveBeenCalled();
    expect(await readNotes()).toEqual([]);
  });

  it('still saves the clip when the panel cannot open', async () => {
    const error = new Error('may only be called in response to a user gesture');
    api.sidePanel.open.mockRejectedValue(error);
    await handleClip('text', tab());
    expect(consoleError).toHaveBeenCalledWith('sidePanel.open failed', error);
    expect(await readNotes()).toHaveLength(1);
  });

  it('still saves the clip when sidePanel.open throws synchronously', async () => {
    api.sidePanel.open.mockImplementation(() => {
      throw new TypeError('no sidePanel');
    });
    await handleClip('text', tab());
    expect(await readNotes()).toHaveLength(1);
  });

  it('saves the clip without opening a panel when there is no window', async () => {
    await handleClip('text', tab({ windowId: -1 }));
    await handleClip('text', undefined);
    expect(api.sidePanel.open).not.toHaveBeenCalled();
    expect(await readNotes()).toEqual([
      expect.objectContaining({ title: 'An article' }),
      expect.objectContaining({ title: 'Untitled' }),
    ]);
  });

  it('logs instead of throwing when storage fails', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('quota'));
    await expect(handleClip('text', tab())).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith('Saving the clip failed', expect.any(Error));
  });
});
