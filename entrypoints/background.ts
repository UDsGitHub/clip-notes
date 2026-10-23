import type { Browser } from 'wxt/browser';
import { saveClip } from '@/lib/clip';
import { CLIP_MENU_ID, CLIP_MENU_TITLE } from '@/lib/constants';

type Tab = Browser.tabs.Tab;

/**
 * Handles "Save to Notes" on selected text. `sidePanel.open()` is called synchronously, before
 * any `await`: Chrome only accepts it while the click's user gesture is still active (1.0 awaited
 * a storage write first, so the panel often failed to open). The note is then written straight
 * to storage, where an open panel picks it up.
 */
export async function handleClip(selectionText: string | undefined, tab?: Tab) {
  if (!selectionText?.trim()) return;
  const opened = tab?.windowId !== undefined && tab.windowId >= 0 ? openPanel(tab.windowId) : null;
  try {
    await saveClip({ text: selectionText, pageTitle: tab?.title, pageUrl: tab?.url });
  } catch (error) {
    console.error('Saving the clip failed', error);
  }
  await opened;
}

function openPanel(windowId: number): Promise<void> {
  try {
    return browser.sidePanel.open({ windowId }).catch((error: unknown) => {
      console.error('sidePanel.open failed', error);
    });
  } catch (error) {
    console.error('sidePanel.open failed', error);
    return Promise.resolve();
  }
}

export default defineBackground(() => {
  // Runs on every service-worker start, so the toolbar icon always opens the side panel.
  void (async () => {
    try {
      await browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      console.error('setPanelBehavior failed', error);
    }
  })();

  // Menus persist across service-worker restarts, so create them only on install or update.
  // removeAll first: an update would otherwise fail with a duplicate-id error.
  browser.runtime.onInstalled.addListener(() => {
    void (async () => {
      try {
        await browser.contextMenus.removeAll();
        browser.contextMenus.create(
          { id: CLIP_MENU_ID, title: CLIP_MENU_TITLE, contexts: ['selection'] },
          () => {
            if (browser.runtime.lastError) {
              console.error('contextMenus.create failed', browser.runtime.lastError);
            }
          },
        );
      } catch (error) {
        console.error('Creating the context menu failed', error);
      }
    })();
  });

  // Registered synchronously at top level so it fires after the worker wakes.
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CLIP_MENU_ID) void handleClip(info.selectionText, tab);
  });
});
