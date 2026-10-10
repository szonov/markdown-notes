import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  untitledNotePath,
  type GraphInfo,
  type PinnedNote,
  type Settings,
} from '@reflect/core'
import type { CommandContext } from '@/lib/commands/types.ts'
import type { NoteRoute, Route } from '@/routing/route.ts'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'
import { RouterProvider } from '@/routing/router.tsx'
import { expectLocatorToHaveCount } from '@/test-utils/expect.ts'

const getPinnedNotes = vi.hoisted(() => vi.fn<() => Promise<PinnedNote[]>>(async () => []))
const revealItemInDir = vi.hoisted(() => vi.fn<(path: string) => Promise<void>>(async () => {}))
const openRouteInNewWindow = vi.hoisted(() => vi.fn<(route: NoteRoute) => Promise<boolean>>())
const openRecent = vi.hoisted(() => vi.fn())
const pickAndOpen = vi.hoisted(() => vi.fn())
const chooseGraph = vi.hoisted(() => vi.fn())
interface NativeContextMenuItemForTest {
  text: string
  action: () => void
}

interface NativeContextMenuOptionsForTest {
  items: NativeContextMenuItemForTest[]
}

const openNativeContextMenu = vi.hoisted(() =>
  vi.fn(async (options: NativeContextMenuOptionsForTest) => {
    options.items[0]?.action()
  }),
)
const operationFail = vi.hoisted(() => vi.fn())
const startOperation = vi.hoisted(() => vi.fn(() => ({ fail: operationFail })))
vi.mock('@/lib/operations.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/operations.ts')>()),
  startOperation,
}))
const commitNoteFrontmatter = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@/lib/note-frontmatter.ts', () => ({
  commitNoteFrontmatter,
  readNoteSource: async () => '# Rust\n',
}))
const updateSettingsWith = vi.hoisted(() =>
  vi.fn<(updater: (current: Settings) => Partial<Settings>) => void>(),
)

vi.mock('@reflect/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@reflect/core')>()),
  hasBridge: () => true,
  getPinnedNotes,
}))
vi.mock('@tauri-apps/plugin-opener', () => ({ revealItemInDir }))
vi.mock('@/lib/windows/open-in-new-window.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/windows/open-in-new-window.ts')>()),
  openRouteInNewWindow,
}))
vi.mock('@/lib/native-menu/context-menu.ts', () => ({ openNativeContextMenu }))

vi.mock('@/providers/graph-provider.tsx', () => ({
  useGraph: () => ({
    graph: GRAPH,
    recents: [
      { root: '/notes', name: 'Notes', openedMs: 2 },
      { root: '/work', name: 'Work', openedMs: 1 },
    ],
    indexing: false,
    openRecent,
    pickAndOpen,
    chooseGraph,
  }),
}))
vi.mock('@/providers/settings-provider.tsx', () => ({
  useSettings: () => ({
    settings: { dateFormat: 'mdy', graphColors: {} },
    updateSettings: () => {},
    updateSettingsWith,
  }),
}))
const GRAPH: GraphInfo = { root: '/notes', name: 'Notes', generation: 1 }

// Import after the core mock so the command registry sees the mocked module.
const { Sidebar } = await import('./sidebar.tsx')
const { registerAppCommands } = await import('@/lib/commands/app-commands.ts')
registerAppCommands()

beforeEach(() => {
  getPinnedNotes.mockReset().mockResolvedValue([])
  revealItemInDir.mockClear()
  openRouteInNewWindow.mockReset().mockResolvedValue(true)
  openRecent.mockClear()
  pickAndOpen.mockClear()
  chooseGraph.mockClear()
  updateSettingsWith.mockClear()
  openNativeContextMenu.mockClear()
  operationFail.mockClear()
  startOperation.mockClear()
  commitNoteFrontmatter.mockClear()
})

async function renderSidebar(overrides?: Partial<CommandContext>, initialRoute?: Route) {
  const navigate = vi.fn()
  const openPalette = vi.fn()
  const context: CommandContext = {
    navigate,
    route: () => ({ kind: 'today' }),
    notePath: () => null,
    back: vi.fn(),
    forward: vi.fn(),
    clearScrollState: vi.fn(),
    togglePin: vi.fn(async () => {}),
    toggleTheme: vi.fn(),
    toggleSidebar: vi.fn(),
    openNoteFind: vi.fn(),
    findNextInNote: vi.fn(),
    findPreviousInNote: vi.fn(),
    switchGraph: vi.fn(),
    generation: () => 1,
    graphRoot: () => '/notes',
    openPalette,
    openShortcuts: vi.fn(),
    ...overrides,
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // The app constrains the sidebar to its rail width; without it the graph
  // menu's anchor spans the viewport and popper pushes the submenu off-screen.
  const view = await render(
    <div style={{ width: 260, height: 560 }}>
      <TooltipProvider>
        <QueryClientProvider client={client}>
          <RouterProvider initialRoute={initialRoute}>
            <Sidebar graph={GRAPH} context={context} />
          </RouterProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </div>,
  )
  return { view, navigate, openPalette, context }
}

describe('Sidebar', () => {
  it('nav rows navigate, with Daily notes always re-anchoring to today', async () => {
    const { view, navigate } = await renderSidebar(undefined, { kind: 'settings' })

    // The Daily row shares the ⌘D capture command: omitting
    // `restoreSurfaceScroll` makes even an off-surface return discard the
    // stream's saved position and re-anchor on today.
    await view.getByRole('button', { name: /daily notes/i }).click()
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ kind: 'today' }, { focusEditor: true }),
    )

    await view.getByRole('button', { name: /settings/i }).click()
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ kind: 'settings' }))
  })

  it('New note runs its command and shows active while the placeholder note is open', async () => {
    // The route a ⌘N/new-note click lands on: a fresh ULID placeholder path.
    const { view, navigate } = await renderSidebar(undefined, {
      kind: 'note',
      path: untitledNotePath(),
    })
    const newNote = view.getByRole('button', { name: /new note/i })

    // Active like every other row whose route is current — until the birth
    // rename moves the note onto a title slug.
    await expect.element(newNote).toHaveAttribute('aria-current', 'page')

    await newNote.click()
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'note', path: expect.stringMatching(/^notes\/.+\.md$/) }),
      ),
    )
  })

  it('New note is inactive on slug-named note routes', async () => {
    const { view } = await renderSidebar(undefined, { kind: 'note', path: 'notes/meeting.md' })
    await expect
      .element(view.getByRole('button', { name: /new note/i }))
      .not.toHaveAttribute('aria-current')
  })

  it('All notes stays active while editing a slug-named note', async () => {
    const { view } = await renderSidebar(undefined, { kind: 'note', path: 'notes/meeting.md' })
    await expect
      .element(view.getByRole('button', { name: /all notes/i }))
      .toHaveAttribute('aria-current', 'page')
  })

  it('only "New note" — not "All notes" — lights for the untitled placeholder', async () => {
    // A brand-new note is still an untitled placeholder, so the two rows must
    // never light at once.
    const { view } = await renderSidebar(undefined, { kind: 'note', path: untitledNotePath() })
    await expect
      .element(view.getByRole('button', { name: /new note/i }))
      .toHaveAttribute('aria-current', 'page')
    await expect
      .element(view.getByRole('button', { name: /all notes/i }))
      .not.toHaveAttribute('aria-current')
  })

  it('the search affordance opens the palette', async () => {
    const { view, openPalette } = await renderSidebar()
    await view.getByRole('button', { name: /search anything/i }).click()
    expect(openPalette).toHaveBeenCalled()
  })

  it('pinned notes render their own section', async () => {
    getPinnedNotes.mockResolvedValue([
      { path: 'notes/roadmap.md', title: 'Roadmap', dailyDate: null },
    ])
    const { view } = await renderSidebar()

    const pinnedSection = view.getByRole('region', { name: /pinned notes/i })
    await expect.element(pinnedSection).toMatchTextContent('Roadmap')
    await expectLocatorToHaveCount(view.getByRole('button', { name: 'Roadmap' }), 1)

    const roadmap = pinnedSection.getByRole('button', { name: 'Roadmap' })
    await expect.element(roadmap).toBeInTheDocument()
    const roadmapPreview = roadmap.element().firstElementChild
    expect(roadmapPreview?.getAttribute('class')).toContain('hover:bg-surface-hover')
    expect(roadmapPreview?.getAttribute('class')).toContain('hover:text-text')
    await roadmap.click()
    await expect.element(roadmap).toHaveAttribute('aria-current', 'page')
    expect(roadmapPreview?.getAttribute('class')).toContain('dark:text-accent')
  })

  it('modifier-click opens a pinned note in a new window without changing routes', async () => {
    getPinnedNotes.mockResolvedValue([
      { path: 'notes/roadmap.md', title: 'Roadmap', dailyDate: null },
    ])
    const { view } = await renderSidebar()
    const roadmap = view.getByRole('button', { name: 'Roadmap' })

    await roadmap.click({ modifiers: ['ControlOrMeta'] })

    await vi.waitFor(() =>
      expect(openRouteInNewWindow).toHaveBeenCalledWith({
        kind: 'note',
        path: 'notes/roadmap.md',
      }),
    )
    expect(openRouteInNewWindow).toHaveBeenCalledTimes(1)
    await expect.element(roadmap).not.toHaveAttribute('aria-current')
  })

  it('renders wiki links in pinned note titles as display text', async () => {
    getPinnedNotes.mockResolvedValue([
      { path: 'notes/meeting.md', title: 'Meeting with [[Ada Lovelace|Ada]]', dailyDate: null },
    ])
    const { view } = await renderSidebar()

    const pinnedSection = view.getByRole('region', { name: /pinned notes/i })
    await expect.element(pinnedSection).toMatchTextContent('Meeting with Ada')
    expect(pinnedSection.element().textContent).not.toContain('[[Ada Lovelace|Ada]]')
    await expect.element(view.getByRole('button', { name: 'Meeting with Ada' })).toBeInTheDocument()
  })

  it('All notes is inactive while the active note is pinned', async () => {
    getPinnedNotes.mockResolvedValue([
      { path: 'notes/roadmap.md', title: 'Roadmap', dailyDate: null },
    ])
    const { view } = await renderSidebar(undefined, { kind: 'note', path: 'notes/roadmap.md' })

    const roadmap = view.getByRole('button', { name: 'Roadmap' })
    await expect.element(roadmap).toHaveAttribute('aria-current', 'page')
    await expect
      .element(view.getByRole('button', { name: /all notes/i }))
      .not.toHaveAttribute('aria-current')
  })

  it('the pinned section is hidden while nothing is pinned', async () => {
    getPinnedNotes.mockResolvedValue([])
    const { view } = await renderSidebar()
    await vi.waitFor(() => expect(getPinnedNotes).toHaveBeenCalled())
    expect(view.getByRole('region', { name: /pinned notes/i }).query()).toBeNull()
  })

  it('right-click unpins a pinned row through the native context menu', async () => {
    getPinnedNotes.mockResolvedValue([{ path: 'notes/rust.md', title: 'Rust', dailyDate: null }])
    const { view } = await renderSidebar()
    const rust = view.getByRole('button', { name: 'Rust' })

    await rust.click({ button: 'right' })

    await vi.waitFor(() =>
      expect(openNativeContextMenu).toHaveBeenCalledWith({
        items: [
          expect.objectContaining({
            text: 'Unpin note',
          }),
        ],
      }),
    )
    await expectLocatorToHaveCount(view.getByRole('button', { name: 'Rust' }), 0)
    expect(commitNoteFrontmatter).toHaveBeenCalledWith('notes/rust.md', { pinned: false }, 1)
  })

  it('restores an optimistically removed pinned row when unpin fails', async () => {
    commitNoteFrontmatter.mockRejectedValueOnce(new Error('disk failed'))
    getPinnedNotes.mockResolvedValue([{ path: 'notes/rust.md', title: 'Rust', dailyDate: null }])
    const { view } = await renderSidebar()
    const rust = view.getByRole('button', { name: 'Rust' })

    await rust.click({ button: 'right' })

    await vi.waitFor(() =>
      expect(commitNoteFrontmatter).toHaveBeenCalledWith('notes/rust.md', { pinned: false }, 1),
    )
    await expect.element(view.getByRole('button', { name: 'Rust' })).toBeInTheDocument()
    expect(startOperation).toHaveBeenCalledExactlyOnceWith('Updating pin')
    expect(operationFail).toHaveBeenCalledExactlyOnceWith('disk failed')
  })

  it('history arrows walk the router stack and disable at its edges', async () => {
    getPinnedNotes.mockResolvedValue([{ path: 'notes/rust.md', title: 'Rust', dailyDate: null }])
    const { view } = await renderSidebar()
    const backButton = view.getByRole('button', { name: 'Go back' })
    const forwardButton = view.getByRole('button', { name: 'Go forward' })
    await expect.element(backButton).toBeDisabled()
    await expect.element(forwardButton).toBeDisabled()

    // Pinned rows push onto the real router, enabling history navigation.
    const rust = view.getByRole('button', { name: 'Rust' })
    await rust.click()
    await expect.element(backButton).toBeEnabled()

    await backButton.click()
    await expect.element(rust).not.toHaveAttribute('aria-current')
    await expect.element(forwardButton).toBeEnabled()

    await forwardButton.click()
    await expect.element(rust).toHaveAttribute('aria-current', 'page')
  })

  it('the graph footer switches to another recent graph', async () => {
    const { view } = await renderSidebar()

    await view.getByRole('button', { name: /Notes/ }).click()
    const work = page.getByRole('menuitem', { name: 'Work', exact: true })
    await expect.element(work).toBeVisible()
    expect(
      [...work.element().querySelectorAll('kbd')].map((keycap) => keycap.textContent),
    ).toContain('2')
    await work.click()
    expect(openRecent).toHaveBeenCalledWith('/work')

    await view.getByRole('button', { name: /Notes/ }).click()
    await page.getByRole('menuitem', { name: /open another graph/i }).click()
    expect(chooseGraph).toHaveBeenCalled()
    expect(pickAndOpen).not.toHaveBeenCalled()
  })

  it('the graph footer opens preferences from the graph menu', async () => {
    const { view, navigate } = await renderSidebar()

    await view.getByRole('button', { name: /Notes/ }).click()
    await page.getByRole('menuitem', { name: 'Preferences' }).click()

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ kind: 'settings' }))
  })

  it('the graph footer opens the current graph in the system file manager', async () => {
    const { view } = await renderSidebar()

    await view.getByRole('button', { name: /Notes/ }).click()
    await page.getByRole('menuitem', { name: /reveal graph in finder/i }).click()

    expect(revealItemInDir).toHaveBeenCalledWith('/notes')
  })

  it.each([
    { name: 'Notes', root: '/notes' },
    { name: 'Work', root: '/work' },
  ])('recolors $name from its swatch without switching graphs', async ({ name, root }) => {
    const { view } = await renderSidebar()

    await view.getByRole('button', { name: /Notes/ }).click()
    await expect
      .element(page.getByRole('menuitem', { name: 'Graph color', exact: true }))
      .not.toBeInTheDocument()
    await page.getByRole('menuitem', { name: `Change color for ${name}` }).click()
    await expect
      .element(page.getByRole('menuitemradio', { name: 'Indigo' }))
      .toHaveAttribute('aria-checked', 'true')
    await page.getByRole('menuitemradio', { name: 'Teal' }).click()
    await expect.element(page.getByRole('menuitemradio', { name: 'Teal' })).not.toBeInTheDocument()
    expect(updateSettingsWith).toHaveBeenCalledTimes(1)
    expect(openRecent).not.toHaveBeenCalled()

    const updater = updateSettingsWith.mock.lastCall?.[0]
    expect(updater?.({ ...DEFAULT_SETTINGS, graphColors: { '/other': 'red' } })).toEqual({
      graphColors: { '/other': 'red', [root]: 'teal' },
    })
  })

  it('opens and dismisses a graph color menu from the keyboard', async () => {
    const { view } = await renderSidebar()
    view.getByRole('button', { name: /Notes/ }).element().focus()
    await userEvent.keyboard('{ArrowDown}')
    const swatch = page.getByRole('menuitem', { name: 'Change color for Notes' })
    await expect.element(swatch).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(page.getByRole('menuitemradio', { name: 'Indigo' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect.element(swatch).toHaveFocus()
    await expect.element(swatch).toBeVisible()
    expect(updateSettingsWith).not.toHaveBeenCalled()

    await userEvent.keyboard('{ArrowRight}')
    await expect.element(page.getByRole('menuitemradio', { name: 'Indigo' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(page.getByRole('menuitemradio', { name: 'Blue' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() => expect(updateSettingsWith).toHaveBeenCalledTimes(1))
    expect(updateSettingsWith.mock.lastCall?.[0](DEFAULT_SETTINGS)).toEqual({
      graphColors: { '/notes': 'blue' },
    })
    expect(openRecent).not.toHaveBeenCalled()
  })
})
