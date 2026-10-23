import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import App from '../entrypoints/sidepanel/App';
import { NOTE_BODY_MAX_DISPLAY_LENGTH, NOTES_STORAGE_KEY } from '@/lib/constants';
import * as download from '@/lib/download';
import { readNotes } from '@/lib/notes';

const CREATED = '2026-09-10T12:00:00.000Z';

function stored(id: string, overrides: Record<string, unknown> = {}) {
  return {
    [id]: {
      title: id,
      content: `${id} body`,
      createdAt: CREATED,
      order: 0,
      pinned: false,
      tags: [],
      ...overrides,
    },
  };
}

async function seed(...notes: Record<string, unknown>[]) {
  await fakeBrowser.storage.local.set({ [NOTES_STORAGE_KEY]: Object.assign({}, ...notes) });
}

async function renderApp() {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole('region', { name: 'Notes list' })).toHaveAttribute(
      'aria-busy',
      'false',
    ),
  );
  return user;
}

const cardOf = (title: string) =>
  screen
    .getAllByRole('listitem')
    .find(
      (item) =>
        item.hasAttribute('data-note-id') && within(item).queryByText(title, { exact: true }),
    )!;
const titles = () =>
  screen
    .queryAllByRole('listitem')
    .filter((item) => item.hasAttribute('data-note-id'))
    .map((item) => item.querySelector('.font-bold')!.textContent);

const titleField = () => screen.getByRole('textbox', { name: 'Title' });
const noteField = () => screen.getByRole('textbox', { name: 'Note' });
const tagsField = () => screen.getByRole('textbox', { name: 'Tags (comma-separated)' });

beforeEach(() => {
  fakeBrowser.reset();
});

afterEach(() => vi.restoreAllMocks());

describe('adding notes', () => {
  it('shows the empty state, then lists a new note and clears the form', async () => {
    const user = await renderApp();
    expect(screen.getByText('No notes yet. Add one below.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete all notes' })).toBeDisabled();
    expect(noteField()).toHaveFocus();

    await user.type(titleField(), '  Groceries ');
    await user.type(noteField(), 'Eggs, milk');
    await user.type(tagsField(), 'home, errands, Home');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    await waitFor(() => expect(titles()).toEqual(['Groceries']));
    expect(screen.queryByText('No notes yet. Add one below.')).not.toBeInTheDocument();
    expect(titleField()).toHaveValue('');
    expect(noteField()).toHaveValue('');
    expect(tagsField()).toHaveValue('');
    expect(await readNotes()).toEqual([
      expect.objectContaining({
        title: 'Groceries',
        content: 'Eggs, milk',
        tags: ['home', 'errands'],
      }),
    ]);
    expect(
      within(cardOf('Groceries')).getByRole('button', { name: 'Filter by tag home' }),
    ).toBeVisible();
  });

  it('adds new notes at the top', async () => {
    const user = await renderApp();
    for (const title of ['First', 'Second']) {
      await user.type(titleField(), title);
      await user.type(noteField(), 'body');
      await user.keyboard('{Control>}{Enter}{/Control}');
      await waitFor(() => expect(titles()).toContain(title));
    }
    expect(titles()).toEqual(['Second', 'First']);
  });

  it('explains what’s missing instead of doing nothing, and focuses it', async () => {
    const user = await renderApp();
    await user.type(noteField(), '   ');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    expect(titleField()).toHaveFocus();
    expect(titleField()).toHaveAccessibleDescription('Add a title.');
    expect(noteField()).toHaveAccessibleDescription('Write something in the note.');
    expect(titleField()).toHaveAttribute('aria-invalid', 'true');

    await user.type(titleField(), 'T');
    expect(screen.queryByText('Add a title.')).not.toBeInTheDocument();
    expect(screen.getByText('Write something in the note.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(noteField()).toHaveFocus();
    expect(await readNotes()).toEqual([]);
  });

  it('caps the title at 50 characters', async () => {
    await renderApp();
    expect(titleField()).toHaveAttribute('maxLength', '50');
  });
});

describe('editing', () => {
  it('loads the note into the form, saves it in place and marks it Updated', async () => {
    await seed(stored('Old title', { tags: ['a', 'b'] }), stored('Other', { order: 1 }));
    const user = await renderApp();

    await user.click(within(cardOf('Old title')).getByRole('button', { name: 'Edit Old title' }));
    expect(titleField()).toHaveValue('Old title');
    expect(noteField()).toHaveValue('Old title body');
    expect(tagsField()).toHaveValue('a, b');
    expect(noteField()).toHaveFocus();
    expect(screen.getByRole('form', { name: 'Edit note' })).toBeVisible();

    await user.clear(titleField());
    await user.type(titleField(), 'New title');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(titles()).toEqual(['Other', 'New title']));
    expect(within(cardOf('New title')).getByText('Updated')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'New note' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('Cancel and Escape leave the note unchanged and empty the form', async () => {
    await seed(stored('Note'));
    const user = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Edit Note' }));
    await user.type(noteField(), ' more');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(noteField()).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Edit Note' }));
    await user.keyboard('{Escape}');
    expect(noteField()).toHaveValue('');
    expect((await readNotes())[0]!.content).toBe('Note body');
  });

  it('saves the text as a new note if the note was deleted meanwhile (1.0 lost it)', async () => {
    await seed(stored('Note'));
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Edit Note' }));
    await user.type(noteField(), ' — keep me');

    await act(() => fakeBrowser.storage.local.set({ [NOTES_STORAGE_KEY]: {} }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(
        screen.getByText('That note was deleted, so your changes were saved as a new note.'),
      ).toBeVisible(),
    );
    expect(await readNotes()).toEqual([
      expect.objectContaining({ content: 'Note body — keep me' }),
    ]);
  });
});

describe('deleting', () => {
  it('removes the note and offers Undo, which brings it back in place', async () => {
    await seed(stored('A', { order: 2 }), stored('B', { order: 1 }), stored('C', { order: 0 }));
    const user = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Delete B' }));
    await waitFor(() => expect(titles()).toEqual(['A', 'C']));
    expect(screen.getByText('Note deleted.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(titles()).toEqual(['A', 'B', 'C']));
  });

  it('Delete all asks first; Cancel keeps everything', async () => {
    await seed(stored('A'));
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Delete all notes' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete all notes?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(titles()).toEqual(['A']);
  });

  it('Delete all removes every note and clears search and filters', async () => {
    await seed(stored('A', { tags: ['x'] }), stored('B'));
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'x' }));
    await user.click(screen.getByRole('button', { name: 'Delete all notes' }));
    await user.click(screen.getByRole('button', { name: 'Delete all' }));

    await waitFor(() => expect(screen.getByText('No notes yet. Add one below.')).toBeVisible());
    expect(screen.getByText('All notes deleted.')).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Filter by tag' })).not.toBeInTheDocument();
    expect(await readNotes()).toEqual([]);
  });
});

describe('pinning', () => {
  it('moves a note between the Pinned section and the rest', async () => {
    await seed(stored('A', { order: 1 }), stored('B', { order: 0 }));
    const user = await renderApp();
    expect(screen.queryByRole('heading', { name: 'Pinned' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pin B' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pinned' })).toBeVisible());
    expect(within(screen.getByRole('list', { name: 'Pinned notes' })).getByText('B')).toBeVisible();
    expect(titles()).toEqual(['B', 'A']);

    await user.click(screen.getByRole('button', { name: 'Unpin B' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Pinned' })).not.toBeInTheDocument(),
    );
    expect(titles()).toEqual(['B', 'A']);
  });
});

describe('search and tags', () => {
  beforeEach(() =>
    seed(
      stored('Pasta', { content: 'garlic', tags: ['recipes'], order: 2 }),
      stored('Plan', { content: 'goals', tags: ['work'], order: 1 }),
      stored('Soup', { content: 'garlic too', tags: ['Recipes', 'winter'], order: 0 }),
    ),
  );

  it('lists each tag once as a chip, and filters by one at a time', async () => {
    const user = await renderApp();
    const chips = within(screen.getByRole('group', { name: 'Filter by tag' })).getAllByRole(
      'button',
    );
    expect(chips.map((chip) => chip.textContent)).toEqual(['All', 'recipes', 'winter', 'work']);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');

    await user.click(chips[1]!);
    expect(titles()).toEqual(['Pasta', 'Soup']);
    expect(chips[1]).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'work' }));
    expect(titles()).toEqual(['Plan']);

    await user.click(screen.getByRole('button', { name: 'work' }));
    expect(titles()).toEqual(['Pasta', 'Plan', 'Soup']);
  });

  it('a tag on a card filters by it', async () => {
    const user = await renderApp();
    await user.click(within(cardOf('Soup')).getByRole('button', { name: 'Filter by tag winter' }));
    expect(titles()).toEqual(['Soup']);
  });

  it('searches titles, bodies and tags after typing pauses, within the selected tag', async () => {
    const user = await renderApp();
    await user.type(screen.getByRole('searchbox', { name: 'Search notes' }), 'GARLIC');
    await waitFor(() => expect(titles()).toEqual(['Pasta', 'Soup']));

    await user.click(screen.getByRole('button', { name: 'winter' }));
    expect(titles()).toEqual(['Soup']);

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'nothing like this');
    await waitFor(() => expect(screen.getByText('No notes match your filters.')).toBeVisible());
  });

  it('turns drag to reorder off while filtering', async () => {
    const user = await renderApp();
    expect(screen.getByRole('button', { name: 'Reorder Pasta' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'work' }));
    expect(screen.getByRole('button', { name: 'Reorder Plan' })).toBeDisabled();
  });

  it('goes back to All when the selected tag’s last note is deleted', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'work' }));
    await user.click(screen.getByRole('button', { name: 'Delete Plan' }));
    await waitFor(() => expect(titles()).toEqual(['Pasta', 'Soup']));
    expect(screen.queryByRole('button', { name: 'work' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('note cards', () => {
  it('shortens long bodies with show more / show less', async () => {
    const long = `${'word '.repeat(80)}end`;
    await seed(stored('Long', { content: long }));
    const user = await renderApp();
    const card = cardOf('Long');
    expect(within(card).queryByText(long)).not.toBeInTheDocument();
    const toggle = within(card).getByRole('button', { name: 'show more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(within(card).getByText(long.trim())).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('shows a body of exactly the limit in full, with no toggle', async () => {
    const exact = `${'a'.repeat(NOTE_BODY_MAX_DISPLAY_LENGTH - 5)} bbbb`;
    await seed(stored('Exact', { content: exact }));
    await renderApp();
    expect(within(cardOf('Exact')).getByText(exact)).toBeInTheDocument();
    expect(
      within(cardOf('Exact')).queryByRole('button', { name: 'show more' }),
    ).not.toBeInTheDocument();
  });

  it('keeps line breaks', async () => {
    await seed(stored('Lines', { content: 'one\ntwo' }));
    await renderApp();
    expect(
      within(cardOf('Lines')).getByText(
        (_, el) => el?.textContent === 'one\ntwo' && el.tagName === 'SPAN',
      ),
    ).toHaveClass('whitespace-pre-wrap');
  });

  it('copies the body on click and says so', async () => {
    await seed(stored('Copy me', { content: 'the body' }));
    const user = await renderApp();
    await user.click(within(cardOf('Copy me')).getByText('the body'));
    expect(await navigator.clipboard.readText()).toBe('the body');
    expect(within(cardOf('Copy me')).getByText('Copied')).toBeInTheDocument();
  });

  it('copies from the keyboard too', async () => {
    await seed(stored('Copy me', { content: 'the body' }));
    const user = await renderApp();
    within(cardOf('Copy me'))
      .getByRole('button', { name: /Copy me the body/ })
      .focus();
    await user.keyboard('{Enter}');
    expect(await navigator.clipboard.readText()).toBe('the body');
  });

  it('reports a failed copy instead of claiming success (1.0 always said Copied)', async () => {
    await seed(stored('Copy me'));
    const user = await renderApp();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await user.click(within(cardOf('Copy me')).getByText('Copy me body'));
    await waitFor(() => expect(screen.getByText('Couldn’t copy the note.')).toBeVisible());
    expect(within(cardOf('Copy me')).queryByText('Copied')).not.toBeInTheDocument();
  });

  it('links a clipped note to its page', async () => {
    await seed(stored('Clip', { url: 'https://www.example.com/article' }));
    await renderApp();
    const link = within(cardOf('Clip')).getByRole('link', { name: 'example.com' });
    expect(link).toHaveAttribute('href', 'https://www.example.com/article');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows the edit date', async () => {
    await seed(stored('Dated', { updatedAt: '2026-09-16T07:00:00.000Z' }));
    await renderApp();
    expect(within(cardOf('Dated')).getByText('Sep 16, 2026, 7:00 AM')).toBeInTheDocument();
  });
});

describe('live updates', () => {
  it('shows notes clipped or changed elsewhere without a reload', async () => {
    await seed(stored('Existing'));
    await renderApp();
    await act(() =>
      fakeBrowser.storage.local.set({
        [NOTES_STORAGE_KEY]: { ...stored('Existing'), ...stored('Clipped', { order: 1 }) },
      }),
    );
    expect(titles()).toEqual(['Clipped', 'Existing']);
  });

  it('reads notes stored by 1.0 (no order, pinned or tags)', async () => {
    await seed({
      old: { title: 'Older', content: 'x', createdAt: '2026-01-01T00:00:00.000Z' },
      new: { title: 'Newer', content: 'y', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: null },
    });
    await renderApp();
    expect(titles()).toEqual(['Newer', 'Older']);
  });
});

describe('import and export', () => {
  it('imports pasted JSON, closes, and reports the result', async () => {
    await seed(stored('Existing'));
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Import notes' }));
    const dialog = screen.getByRole('dialog', { name: 'Import notes' });

    const json = JSON.stringify([
      { id: 'Existing', title: 'Dup', content: 'x', createdAt: CREATED },
      { id: 'new', title: 'Imported', content: 'y', createdAt: CREATED, tags: ['z'] },
    ]);
    await user.click(within(dialog).getByRole('textbox', { name: 'Notes to import' }));
    await user.paste(json);
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));

    await waitFor(() =>
      expect(screen.getByText('Imported 1 note. Skipped 1 that already exist.')).toBeVisible(),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 2000,
    });
    expect(titles()).toEqual(['Imported', 'Existing']);
  });

  it('imports a CSV file picked from disk', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Import notes' }));
    const file = new File(
      [`id,title,content,createdAt\n"a","From CSV","body","${CREATED}"`],
      'notes.csv',
      {
        type: 'text/csv',
      },
    );
    await user.upload(
      screen.getByLabelText('Drop a .json or .csv file here, or click to browse'),
      file,
    );
    expect(screen.getByText('notes.csv')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(titles()).toEqual(['From CSV']));
  });

  it('shows what’s wrong with the input and stays open', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Import notes' }));
    await user.click(screen.getByRole('radio', { name: 'CSV' }));
    expect(screen.getByRole('textbox', { name: 'Notes to import' })).toHaveAttribute(
      'placeholder',
      'id,title,content,createdAt,updatedAt,order,pinned,tags,url',
    );
    await user.click(screen.getByRole('textbox', { name: 'Notes to import' }));
    await user.paste('id,title\n"a","b"');
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'CSV is missing the content, createdAt column.',
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Import notes' })).toBeInTheDocument();
  });

  it('warns and stays open when every note already exists', async () => {
    await seed(stored('a'));
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Import notes' }));
    await user.click(screen.getByRole('textbox', { name: 'Notes to import' }));
    await user.paste(JSON.stringify([{ id: 'a', title: 'T', content: 'C', createdAt: CREATED }]));
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() =>
      expect(screen.getByText('No notes imported. 1 already exists.')).toBeVisible(),
    );
    expect(screen.getByRole('dialog', { name: 'Import notes' })).toBeInTheDocument();
  });

  it('exports CSV and JSON as downloads', async () => {
    await seed(stored('A'));
    const downloadBlob = vi.spyOn(download, 'downloadBlob').mockImplementation(() => {});
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Export as CSV' }));
    await waitFor(() => expect(screen.getByText('CSV downloaded.')).toBeVisible());
    await user.click(screen.getByRole('button', { name: 'Export as JSON' }));
    await waitFor(() => expect(screen.getByText('JSON downloaded.')).toBeVisible());
    expect(downloadBlob.mock.calls.map((call) => call[1])).toEqual([
      'clip-notes_notes.csv',
      'clip-notes_notes.json',
    ]);
  });
});

describe('saving', () => {
  it('clears the form at once, so text typed during the save is kept', async () => {
    const user = await renderApp();
    await user.type(titleField(), 'First');
    await user.type(noteField(), 'body');
    await user.keyboard('{Control>}{Enter}{/Control}');
    // No waiting for the save: the next note starts straight away.
    await user.type(titleField(), 'Second');
    await waitFor(() => expect(titles()).toEqual(['First']));
    expect(titleField()).toHaveValue('Second');
  });

  it('hands the text back when saving fails', async () => {
    const user = await renderApp();
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('quota'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await user.type(titleField(), 'Title');
    await user.type(noteField(), 'Body');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() =>
      expect(screen.getByText('Couldn’t save the note. Try again.')).toBeVisible(),
    );
    expect(titleField()).toHaveValue('Title');
    expect(noteField()).toHaveValue('Body');
  });
});
