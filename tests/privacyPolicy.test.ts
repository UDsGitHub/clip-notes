import fs from 'node:fs';
import path from 'node:path';
import config from '../wxt.config';

// The privacy policy is published with GitHub Pages (docs/privacy/) for the store listing.
const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'docs/privacy/index.html'), 'utf8');
const permissions = (config.manifest as { permissions: string[] }).permissions;

/** How the policy names each permission. */
const PERMISSION_LABELS: Record<string, string> = {
  sidePanel: 'Side panel',
  storage: 'Storage',
  contextMenus: 'Context menus',
};

/** The text of the page's <main>, as a reader sees it (tags dropped, spaces collapsed). */
function policyText() {
  const main = new DOMParser().parseFromString(html, 'text/html').querySelector('main');
  return main?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('privacy policy', () => {
  const text = policyText();

  it('is final: no draft note, a date and a contact', () => {
    expect(text.length).toBeGreaterThan(500);
    expect(text).not.toMatch(/draft|placeholder|TODO/i);
    expect(text).toMatch(/Effective \w+ \d{1,2}, \d{4}/);
    expect(text).toContain('dingding8003@gmail.com');
  });

  it('names every permission the manifest asks for', () => {
    for (const permission of permissions) {
      expect(PERMISSION_LABELS, `a label for ${permission}`).toHaveProperty(permission);
      expect(text).toContain(PERMISSION_LABELS[permission]);
    }
  });

  it('has its icon beside it, the extension’s own', () => {
    const icon = fs.readFileSync(path.join(root, 'docs/privacy/icon.png'));
    expect(icon.equals(fs.readFileSync(path.join(root, 'public/icon/128.png')))).toBe(true);
  });
});
