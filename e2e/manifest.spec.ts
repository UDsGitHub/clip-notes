import fs from 'node:fs';
import path from 'node:path';
import { EXTENSION_PATH, expect, test } from './fixtures';

// 1.1 dropped `downloads` (exports save through a link). Removing a permission never prompts
// existing users; adding one would, so this list only grows by decision.
test('the production manifest asks for nothing more than it needs', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, 'manifest.json'), 'utf8'));
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.name).toBe('Clip Notes');
  expect(manifest.minimum_chrome_version).toBe('123');
  expect([...manifest.permissions].sort()).toEqual(['contextMenus', 'sidePanel', 'storage']);
  expect(manifest.host_permissions).toBeUndefined();
  expect(manifest.optional_permissions).toBeUndefined();
  expect(manifest.content_scripts).toBeUndefined();
  expect(manifest.web_accessible_resources).toBeUndefined();
  expect(manifest.externally_connectable).toBeUndefined();
  expect(manifest.side_panel?.default_path).toBe('sidepanel.html');
  expect(manifest.icons).toEqual({
    16: 'icon/16.png',
    32: 'icon/32.png',
    48: 'icon/48.png',
    128: 'icon/128.png',
  });
});
