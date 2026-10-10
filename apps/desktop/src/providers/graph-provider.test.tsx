import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { open } from '@tauri-apps/plugin-dialog'
import { setBridge } from '@reflect/core'
import { GraphProvider, useGraph } from './graph-provider.tsx'
import { SettingsProvider } from './settings-provider.tsx'

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@/lib/platform.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/platform.ts')>()),
  isNativeShell: () => true,
}))

/**
 * Exercises the provider's open-ordering guards: overlapping opens are
 * serialized against the backend and only the most recently requested one may
 * commit UI state.
 */

let invokeLog: string[]
/** Pending `graph_open` resolvers keyed by requested root. */
let pendingOpens: Map<string, () => void>
let failOpens: boolean
/** What `recent_graphs` returns — set before render to simulate prior opens. */
let storedRecents: Array<{ root: string; name: string; openedMs: number }>
/** What `list_files` returns — set before render to simulate existing notes. */
let storedFiles: Array<{ path: string; size: number; modifiedMs: number }>
/** The fake `index_meta` table (the welcome marker lives here). */
let metaStore: Record<string, string>
/** A fresh QueryClient per test — the settings provider reads through it. */
let queryClient: QueryClient

/** The fixed app-local mobile root. */
const MOBILE_ROOT = '/Documents'

function installFakeBridge(): void {
  invokeLog = []
  pendingOpens = new Map()
  failOpens = false
  storedRecents = []
  storedFiles = []
  metaStore = {}
  let generation = 0
  setBridge({
    invoke: async (command, args) => {
      invokeLog.push(command === 'graph_open' ? `${command}:${String(args['path'])}` : command)
      switch (command) {
        case 'graph_open': {
          if (failOpens) {
            throw { kind: 'io', message: 'cannot open graph' }
          }
          const root = String(args['path'])
          await new Promise<void>((resolve) => {
            pendingOpens.set(root, resolve)
          })
          generation += 1
          return { root, name: root.split('/').findLast(Boolean) ?? '', generation }
        }
        case 'recent_graphs':
          return storedRecents
        case 'forget_recent':
          storedRecents = storedRecents.filter((recent) => recent.root !== String(args['root']))
          return null
        case 'mobile_storage_local':
          return MOBILE_ROOT
        case 'settings_load':
          return {}
        case 'settings_save':
          return null
        case 'index_open':
          return generation
        case 'list_files':
          return storedFiles
        case 'vault_scan_stats':
          return { notes: storedFiles.length, attachments: 0, skipped: 0 }
        case 'index_meta_set':
          metaStore[String(args['key'])] = String(args['value'])
          return null
        case 'db_query': {
          // The only meta read the provider issues is the welcome marker.
          const sql = String(args['sql'] ?? '')
          if (/index_?meta/i.test(sql)) {
            const key = String((args['params'] as unknown[])?.[0])
            return key in metaStore ? [{ value: metaStore[key] }] : []
          }
          return []
        }
        default:
          return null
      }
    },
    listen: async () => () => {},
  })
}

function resolveOpen(root: string): void {
  pendingOpens.get(root)?.()
  pendingOpens.delete(root)
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <GraphProvider>{children}</GraphProvider>
      </SettingsProvider>
    </QueryClientProvider>
  )
}

function mobileWrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <GraphProvider platform="ios">{children}</GraphProvider>
      </SettingsProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  installFakeBridge()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  setBridge(null)
})

describe('GraphProvider open sequencing', () => {
  it('starts at the chooser when there are no recents', async () => {
    const { result } = await renderHook(() => useGraph(), { wrapper })
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))
    expect(result.current.graph).toBeNull()
  })

  it('reopens the newest graph by timestamp without depending on shortcut order', async () => {
    storedRecents = [
      { root: '/shortcut-one', name: 'shortcut-one', openedMs: 10 },
      { root: '/shortcut-two', name: 'shortcut-two', openedMs: 20 },
    ]
    const { result, act } = await renderHook(() => useGraph(), { wrapper })

    await vi.waitFor(() => expect(invokeLog).toContain('graph_open:/shortcut-two'))
    expect(invokeLog).not.toContain('graph_open:/shortcut-one')
    await act(() => resolveOpen('/shortcut-two'))
    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('serializes overlapping opens and commits only the last requested graph', async () => {
    const { result, act } = await renderHook(() => useGraph(), { wrapper })
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))

    let firstOpen: Promise<boolean>
    let secondOpen: Promise<boolean>
    await act(() => {
      firstOpen = result.current.openRecent('/a')
      secondOpen = result.current.openRecent('/b')
    })

    // The second backend open must wait for the first (Rust GraphState is
    // last-write-wins; running in request order keeps it on the last graph).
    await vi.waitFor(() => expect(invokeLog).toContain('graph_open:/a'))
    expect(invokeLog).not.toContain('graph_open:/b')

    await act(async () => {
      resolveOpen('/a')
      await vi.waitFor(() => expect(invokeLog).toContain('graph_open:/b'))
      resolveOpen('/b')
      await firstOpen
      await secondOpen
    })

    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
    // The superseded first open must not have committed its graph.
    expect(result.current.graph?.root).toBe('/b')
  })

  it('closes note windows BEFORE the backend open bumps the session', async () => {
    // Note windows adopted the outgoing session; their close-requested
    // flushes must land against its still-valid generation, so the close
    // command precedes graph_open (bump-first would reject the saves).
    const { result, act } = await renderHook(() => useGraph(), { wrapper })
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))

    let opened: Promise<boolean>
    await act(() => {
      opened = result.current.openRecent('/a')
    })
    await vi.waitFor(() => expect(invokeLog).toContain('graph_open:/a'))
    expect(invokeLog.indexOf('close_note_windows')).toBeGreaterThanOrEqual(0)
    expect(invokeLog.indexOf('close_note_windows')).toBeLessThan(invokeLog.indexOf('graph_open:/a'))
    await act(async () => {
      resolveOpen('/a')
      await opened
    })
  })

  it('surfaces an open failure and returns to the chooser', async () => {
    const { result, act } = await renderHook(() => useGraph(), { wrapper })
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))

    failOpens = true
    await act(async () => {
      await result.current.openRecent('/broken')
    })

    expect(result.current.status).toBe('choosing')
    expect(result.current.error).toMatch(/cannot open graph/)
  })

  it('forgets the open graph and returns to the chooser', async () => {
    storedRecents = [{ root: '/known', name: 'known', openedMs: 1 }]
    const { result, act } = await renderHook(() => useGraph(), { wrapper })

    await act(async () => {
      await vi.waitFor(() => expect(pendingOpens.has('/known')).toBe(true))
      resolveOpen('/known')
    })
    await vi.waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => {
      await result.current.forget('/known')
    })

    expect(result.current.status).toBe('choosing')
    expect(result.current.graph).toBeNull()
    expect(result.current.indexGeneration).toBeNull()
    expect(result.current.recents).toEqual([])
  })

  it('returns to the graph chooser without opening the folder picker', async () => {
    storedRecents = [{ root: '/known', name: 'known', openedMs: 1 }]
    const { result, act } = await renderHook(() => useGraph(), { wrapper })

    await act(async () => {
      await vi.waitFor(() => expect(pendingOpens.has('/known')).toBe(true))
      resolveOpen('/known')
    })
    await vi.waitFor(() => expect(result.current.status).toBe('ready'))

    vi.mocked(open).mockClear()
    await act(async () => {
      await result.current.chooseGraph()
    })

    expect(result.current.status).toBe('choosing')
    expect(result.current.graph).toBeNull()
    expect(result.current.indexGeneration).toBeNull()
    expect(open).not.toHaveBeenCalled()
    expect(result.current.recents).toEqual(storedRecents)
  })
})

describe('GraphProvider welcome seeding', () => {
  it('seeds an empty unmarked graph and stamps the welcomeSeeded marker', async () => {
    vi.mocked(open).mockResolvedValue('/fresh')
    const { result, act } = await renderHook(() => useGraph(), { wrapper })
    await vi.waitFor(() => expect(result.current.status).toBe('choosing'))

    await act(async () => {
      const picking = result.current.pickAndOpen()
      await vi.waitFor(() => expect(pendingOpens.has('/fresh')).toBe(true))
      resolveOpen('/fresh')
      await picking
    })

    expect(result.current.status).toBe('ready')
    expect(invokeLog).toContain('note_write')
    expect(metaStore['welcomeSeeded']).toBe('true')
  })

  it('never seeds a marked graph, even when it is empty (deleted notes stay deleted)', async () => {
    storedRecents = [{ root: '/known', name: 'known', openedMs: 1 }]
    metaStore['welcomeSeeded'] = 'true'
    const { result, act } = await renderHook(() => useGraph(), { wrapper })

    await act(async () => {
      await vi.waitFor(() => expect(pendingOpens.has('/known')).toBe(true))
      resolveOpen('/known')
    })
    await vi.waitFor(() => expect(result.current.status).toBe('ready'))

    expect(invokeLog).not.toContain('note_write')
  })

  it('marks an unmarked graph with existing notes without writing into it', async () => {
    storedRecents = [{ root: '/existing', name: 'existing', openedMs: 1 }]
    storedFiles = [{ path: 'daily/2026/2026-06-12.md', size: 10, modifiedMs: 0 }]
    const { result, act } = await renderHook(() => useGraph(), { wrapper })

    await act(async () => {
      await vi.waitFor(() => expect(pendingOpens.has('/existing')).toBe(true))
      resolveOpen('/existing')
    })
    await vi.waitFor(() => expect(result.current.status).toBe('ready'))

    expect(invokeLog).not.toContain('note_write')
    // Onboarding was considered: emptying this graph later won't re-seed.
    expect(metaStore['welcomeSeeded']).toBe('true')
  })
})

describe('GraphProvider mobile storage', () => {
  it('opens the app-local Markdown folder without onboarding or cloud storage', async () => {
    const { result, act } = await renderHook(() => useGraph(), { wrapper: mobileWrapper })

    await act(async () => {
      await vi.waitFor(() => expect(pendingOpens.has(MOBILE_ROOT)).toBe(true))
      resolveOpen(MOBILE_ROOT)
    })

    await vi.waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.needsOnboarding).toBe(false)
    expect(result.current.graph?.root).toBe(MOBILE_ROOT)
    expect(result.current.mobileStorageKind).toBe('local')
    expect(result.current.mobileStorageInfo).toEqual({
      localRoot: MOBILE_ROOT,
      icloudDocumentsRoot: null,
      icloudGraphRoots: [],
    })
    expect(invokeLog).not.toContain('mobile_storage')
  })
})
