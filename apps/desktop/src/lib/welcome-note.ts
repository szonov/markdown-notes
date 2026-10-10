import {
  getIndexMeta,
  newNoteId,
  notePath,
  setIndexMeta,
  slugForTitle,
  upsertFrontmatter,
  vaultScanStats,
  writeNote,
} from '@reflect/core'

/**
 * The first-run seed (Plan 15 step 1): a brand-new graph gets one short,
 * pinned "How to use Markdown Notes" note. Onboarding never gates the
 * editor: skipping it is just not reading the note.
 */

const WELCOME_TITLE = 'How to use Markdown Notes'

/** Title-derived slug path, same birth rules as any titled note. */
export const WELCOME_NOTE_PATH = notePath(slugForTitle(WELCOME_TITLE))

/**
 * The `index_meta` key marking that onboarding was considered for this graph.
 * `index_clear` deliberately preserves `index_meta`, so the marker survives
 * index rebuilds; only deleting `.markdown-notes/` wholesale resets it.
 */
export const WELCOME_SEEDED_META_KEY = 'welcomeSeeded'

const WELCOME_BODY = `# ${WELCOME_TITLE}

Markdown Notes opens on today's note. Press ⌘D at any time to return to it.

- **Connect your notes.** Type \`[[\` and a note title to create a [[Wiki Link]].
- **Find anything.** ⌘K searches all notes, and ⌘/ shows every keyboard shortcut.
- **Keep your files.** Every note is stored in this folder as a regular Markdown file.

This note is pinned to the sidebar. When you no longer need it, unpin it with ⌘O.

---

## На русском

Markdown Notes открывается на сегодняшней заметке. Нажмите ⌘D в любой момент, чтобы вернуться к ней.

- **Связывайте заметки.** Введите \`[[\` и название заметки, чтобы создать [[Wiki-ссылку]].
- **Находите нужное.** ⌘K открывает поиск по всем заметкам, а ⌘/ показывает горячие клавиши.
- **Работайте со своими файлами.** Все заметки хранятся в этой папке как обычные Markdown-файлы.

Эта заметка закреплена в боковой панели. Когда она больше не понадобится, открепите её сочетанием ⌘O.
`

export interface EnsureWelcomeNoteOptions {
  /** File-write generation (`graph.generation`) — pins the listing and write. */
  fileGeneration: number
  /** Index-session generation (`index_open`) — pins the meta marker. */
  indexGeneration: number
}

/**
 * Consider onboarding for this graph **exactly once** (find-or-create): when
 * the `welcomeSeeded` marker is absent, an **empty** graph gets the welcome
 * note, while any existing content means this is someone's data and only gets
 * marked. Empty means the scan found nothing at all — no notes, no
 * attachments, and nothing it had to skip: a folder of PDFs, or one whose
 * files were unreadable, must not be seeded into. Either way the marker lands,
 * so deleting the note — or emptying the graph entirely — never re-onboards.
 * The marker is stamped after the write: a failed seed retries on the next
 * open, and a retry that finds the note already on disk converges to marking.
 * Returns whether a seed happened.
 */
export async function ensureWelcomeNote(options: EnsureWelcomeNoteOptions): Promise<boolean> {
  if ((await getIndexMeta(WELCOME_SEEDED_META_KEY)) !== null) {
    return false
  }
  const stats = await vaultScanStats(options.fileGeneration)
  const seeded = stats.notes === 0 && stats.attachments === 0 && stats.skipped === 0
  if (seeded) {
    const source = upsertFrontmatter(WELCOME_BODY, { id: newNoteId(), pinned: true })
    await writeNote(WELCOME_NOTE_PATH, source, options.fileGeneration)
  }
  await setIndexMeta(WELCOME_SEEDED_META_KEY, 'true', options.indexGeneration)
  return seeded
}
