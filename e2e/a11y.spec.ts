import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  animationsSettled,
  card,
  expect,
  expectNoHorizontalScroll,
  openPanel,
  SAMPLE_NOTES,
  seedNotes,
  test,
} from './fixtures';

// Every screen, dialog and menu passes axe's WCAG 2.2 A/AA rules at 320px, in light and dark,
// and never scrolls sideways.

/** Runs axe on what's on screen; collects violations by screen rather than stopping at one. */
async function audit(page: Page, screen: string, found: string[]) {
  await animationsSettled(page);
  await expectNoHorizontalScroll(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  for (const violation of violations) {
    for (const node of violation.nodes) {
      found.push(`${screen}: ${violation.id} (${violation.impact}) ${node.target.join(' ')}
    ${node.html.slice(0, 200)}
    ${node.failureSummary?.split('\n').join('\n    ')}`);
    }
  }
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`every screen passes axe in ${colorScheme}`, async ({ session }) => {
    test.setTimeout(90_000);
    const found: string[] = [];

    const empty = await openPanel(session, { width: 320, colorScheme });
    await audit(empty, 'empty', found);
    await empty.getByRole('button', { name: 'Add note' }).click();
    await audit(empty, 'form errors', found);
    await empty.close();

    await seedNotes(session, {
      ...SAMPLE_NOTES,
      'note-clip': {
        title: 'Clipped article',
        content: `${'A long clipped paragraph. '.repeat(15)}`,
        createdAt: '2026-09-19T08:00:00.000Z',
        order: 4,
        pinned: false,
        tags: [],
        url: 'https://www.example.com/article',
      },
    });
    const panel = await openPanel(session, { width: 320, colorScheme });
    await audit(panel, 'notes', found);

    await panel.getByRole('button', { name: 'personal', exact: true }).click();
    await audit(panel, 'tag filter', found);
    await panel.getByRole('searchbox', { name: 'Search notes' }).fill('nothing matches this');
    await expect(panel.getByText('No notes match your filters.')).toBeVisible();
    await audit(panel, 'no matches', found);
    await panel.getByRole('searchbox', { name: 'Search notes' }).fill('');
    await panel.getByRole('button', { name: 'All', exact: true }).click();

    await card(panel, 'Pasta night').getByRole('button', { name: 'Edit Pasta night' }).click();
    await audit(panel, 'editing', found);
    await panel.keyboard.press('Escape');

    await card(panel, 'Reading list').getByRole('button', { name: 'Delete Reading list' }).click();
    await expect(panel.getByRole('button', { name: 'Undo' })).toBeVisible();
    await audit(panel, 'undo toast', found);

    await panel.getByRole('button', { name: 'Export notes' }).click();
    await expect(panel.getByRole('button', { name: 'Export as CSV' })).toBeVisible();
    await audit(panel, 'export menu', found);
    await panel.keyboard.press('Escape');

    await panel.getByRole('button', { name: 'Import notes' }).click();
    await panel.locator('details summary').click();
    await audit(panel, 'import dialog', found);
    await panel.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(panel.getByRole('alert')).toHaveText('Nothing to import.');
    await audit(panel, 'import error', found);
    await panel.keyboard.press('Escape');

    await panel.getByRole('button', { name: 'Delete all notes' }).click();
    await audit(panel, 'delete all dialog', found);

    expect(found, found.join('\n\n')).toEqual([]);
  });
}
