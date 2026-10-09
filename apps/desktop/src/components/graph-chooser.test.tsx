import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setBridge } from '@reflect/core'
import { GraphProvider } from '@/providers/graph-provider.tsx'
import { SettingsProvider } from '@/providers/settings-provider.tsx'
import '@/test-utils/locator.ts'
import { GraphChooser } from './graph-chooser.tsx'

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))

let invokeLog: Array<[string, Record<string, unknown>]>
let recents: Array<{ root: string; name: string; openedMs: number }>
let storedSettings: Record<string, unknown>
let queryClient: QueryClient

// Mirrors the main.tsx provider order: settings above the graph lifecycle.
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <GraphProvider>{children}</GraphProvider>
      </SettingsProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.stubEnv('TAURI_ENV_PLATFORM', 'darwin')
  invokeLog = []
  recents = [
    { root: '/graphs/work', name: 'work', openedMs: 2 },
    { root: '/graphs/personal', name: 'personal', openedMs: 1 },
  ]
  storedSettings = {}
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  setBridge({
    invoke: async (command, args) => {
      invokeLog.push([command, args])
      switch (command) {
        case 'recent_graphs':
          return recents
        case 'forget_recent':
          recents = recents.filter((recent) => recent.root !== args['root'])
          return null
        case 'graph_open':
          return { root: String(args['path']), name: 'work', generation: 1 }
        case 'index_open':
          return 1
        case 'list_files':
        case 'db_query':
          return []
        case 'vault_scan_stats':
          return { notes: 0, attachments: 0, skipped: 0 }
        case 'settings_load':
          return storedSettings
        default:
          return null
      }
    },
    listen: async () => () => {},
  })
})

afterEach(async () => {
  await cleanup()
  vi.unstubAllEnvs()
  setBridge(null)
  queryClient.clear()
})

describe('GraphChooser', () => {
  // The provider auto-opens the most recent graph on mount, so the chooser's
  // own flows are exercised after that first open settles.
  it('lists recent graphs and reopens one on click', async () => {
    await render(<GraphChooser />, { wrapper })

    await expect.element(page.getByText('personal', { exact: true })).toBeVisible()
    await expect.element(page.getByText('/graphs/personal')).toBeVisible()

    await userEvent.click(page.getByText('personal', { exact: true }))
    await vi.waitFor(() =>
      expect(invokeLog).toContainEqual(['graph_open', { path: '/graphs/personal' }]),
    )
  })

  it('forgets a recent graph and refreshes the list', async () => {
    await render(<GraphChooser />, { wrapper })

    await expect.element(page.getByText('personal', { exact: true })).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Forget personal' }))

    await expect.element(page.getByText('personal', { exact: true })).not.toBeInTheDocument()
    expect(invokeLog).toContainEqual(['forget_recent', { root: '/graphs/personal' }])
  })

  it('tints a recent folder icon with the chosen graph color, muted otherwise', async () => {
    storedSettings = { graphColors: { '/graphs/personal': 'teal' } }
    await render(<GraphChooser />, { wrapper })

    await expect.element(page.getByText('personal', { exact: true })).toBeVisible()
    const personalIcon = page
      .getByRole('button', { name: 'personal /graphs/personal', exact: true })
      .locate('svg')
    await expect.element(personalIcon).toHaveStyle({ color: '#14b8a6' })

    const workIcon = page
      .getByRole('button', { name: 'work /graphs/work', exact: true })
      .locate('svg')
    await expect.element(workIcon).toHaveClass('text-text-muted')
  })
})
