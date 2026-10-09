import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'
import { formatDayLabel } from '@/lib/dates.ts'
import { monthLabel, monthOf } from '@/lib/month-grid.ts'
import type { NoteRoute } from '@/routing/route.ts'
import { RouterProvider, useRouter } from '@/routing/router.tsx'
import { fireEvent } from '@/test-utils/fire-event.ts'
import '@/test-utils/locator.ts'
import { DailyContextSidebar } from './daily-context-sidebar.tsx'

const dailyDatesInRange = vi.hoisted(() => vi.fn())
const openRouteInNewWindow = vi.hoisted(() => vi.fn<(route: NoteRoute) => Promise<boolean>>())
vi.mock('@reflect/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@reflect/core')>()),
  hasBridge: () => true,
  dailyDatesInRange,
}))
vi.mock('@/lib/windows/open-in-new-window.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/windows/open-in-new-window.ts')>()),
  openRouteInNewWindow,
}))
vi.mock('@/providers/graph-provider.tsx', () => ({
  useGraph: () => ({ graph: { root: '/g', name: 'g', generation: 1 } }),
}))
vi.mock('@/providers/settings-provider.tsx', () => ({
  useSettings: () => ({
    settings: { dateFormat: 'mdy', weekStartDay: 'monday' },
    updateSettings: () => {},
  }),
}))
vi.mock('@/lib/use-today.ts', () => ({ useToday: () => '2026-06-10' }))

function RouteProbe(): ReactNode {
  const { route } = useRouter()
  return <output data-testid="route">{JSON.stringify(route)}</output>
}

function renderSidebar(date: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <TooltipProvider>
      <QueryClientProvider client={client}>
        <RouterProvider>
          <DailyContextSidebar date={date} />
          <RouteProbe />
        </RouterProvider>
      </QueryClientProvider>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  window.sessionStorage.clear()
  dailyDatesInRange.mockReset().mockResolvedValue([])
  openRouteInNewWindow.mockReset().mockResolvedValue(true)
})

afterEach(async () => {
  await cleanup()
})

describe('DailyContextSidebar calendar header', () => {
  it('jumps to today and restores the current month from the calendar-icon button', async () => {
    const view = await renderSidebar('2026-06-09')
    await userEvent.click(page.getByRole('button', { name: 'Next month' }))
    await expect.element(page.getByText(monthLabel('2026-07'))).toBeVisible()

    await userEvent.click(page.getByRole('button', { name: 'Jump to today' }))

    await expect.element(page.getByText(monthLabel('2026-06'))).toBeVisible()
    await expect.element(page.getByTestId('route')).toMatchTextContent('"kind":"today"')
    await view.unmount()
  })
})

describe('DailyContextSidebar calendar', () => {
  it('marks days that have a daily note and navigates on day click', async () => {
    dailyDatesInRange.mockResolvedValue(['2026-06-05'])
    const view = await renderSidebar('2026-06-09')

    await expect.element(page.getByTestId('note-dot-2026-06-05')).toBeVisible()
    expect(dailyDatesInRange).toHaveBeenCalledWith('2026-06-01', '2026-07-05')
    await expect.element(page.getByTestId('note-dot-2026-06-04')).not.toBeInTheDocument()

    await userEvent.click(page.getByRole('button', { name: formatDayLabel('2026-06-18', 'mdy') }))
    await expect.element(page.getByTestId('route')).toMatchTextContent('2026-06-18')
    await view.unmount()
  })

  it('modifier-click opens a day in a new window without moving the current window', async () => {
    const view = await renderSidebar('2026-06-09')
    const day = page.getByRole('button', { name: formatDayLabel('2026-06-18', 'mdy') })

    fireEvent.click(day, { metaKey: true, ctrlKey: true })

    await vi.waitFor(() =>
      expect(openRouteInNewWindow).toHaveBeenCalledWith({
        kind: 'daily',
        date: '2026-06-18',
      }),
    )
    expect(openRouteInNewWindow).toHaveBeenCalledTimes(1)
    await expect
      .element(page.getByTestId('route'))
      .toMatchTextContent(JSON.stringify({ kind: 'today' }))
    await view.unmount()
  })

  it('does not fall back after the calendar scope moves to another selected day', async () => {
    let finishOpen: (opened: boolean) => void = () => {}
    openRouteInNewWindow.mockReturnValue(
      new Promise((resolve) => {
        finishOpen = resolve
      }),
    )
    const view = await renderSidebar('2026-06-09')
    const day = page.getByRole('button', { name: formatDayLabel('2026-06-18', 'mdy') })

    fireEvent.click(day, { metaKey: true, ctrlKey: true })
    await vi.waitFor(() => expect(openRouteInNewWindow).toHaveBeenCalledTimes(1))
    await view.rerender(
      <TooltipProvider>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <RouterProvider>
            <DailyContextSidebar date="2026-06-10" />
            <RouteProbe />
          </RouterProvider>
        </QueryClientProvider>
      </TooltipProvider>,
    )

    await act(async () => {
      finishOpen(false)
    })

    await expect
      .element(page.getByTestId('route'))
      .toMatchTextContent(JSON.stringify({ kind: 'today' }))
    await view.unmount()
  })

  it('pages between months across year boundaries', async () => {
    const view = await renderSidebar('2026-01-15')
    await expect.element(page.getByText(monthLabel('2026-01'))).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Previous month' }))
    await expect.element(page.getByText(monthLabel('2025-12'))).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Next month' }))
    await userEvent.click(page.getByRole('button', { name: 'Next month' }))
    await expect.element(page.getByText(monthLabel('2026-02'))).toBeVisible()
    await view.unmount()
  })

  it('re-anchors the visible month when the selected day changes', async () => {
    const view = await renderSidebar('2026-06-09')
    await expect.element(page.getByText(monthLabel('2026-06'))).toBeVisible()
    await view.rerender(
      <TooltipProvider>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <RouterProvider>
            <DailyContextSidebar date="2026-09-01" />
            <RouteProbe />
          </RouterProvider>
        </QueryClientProvider>
      </TooltipProvider>,
    )
    await expect.element(page.getByText(monthLabel('2026-09'))).toBeVisible()
    await view.unmount()
  })
})

describe('DailyContextSidebar sections', () => {
  it('collapses a section and persists the state for the session', async () => {
    const view = await renderSidebar('2026-06-09')
    const header = page.getByRole('button', { name: /Note actions/ })
    await expect.element(header).toHaveAttribute('aria-expanded', 'true')
    await expect.element(page.getByText('Pin this note')).toBeVisible()

    await userEvent.click(header)
    await expect.element(header).toHaveAttribute('aria-expanded', 'false')
    await expect.element(page.getByText('Pin this note')).not.toBeInTheDocument()
    await view.unmount()

    const reopened = await renderSidebar('2026-06-09')
    await expect
      .element(page.getByRole('button', { name: /Note actions/ }))
      .toHaveAttribute('aria-expanded', 'false')
    await reopened.unmount()
  })

  it('the calendar is not collapsible', async () => {
    const view = await renderSidebar('2026-06-09')
    await expect.element(page.getByText(monthLabel(monthOf('2026-06-09')))).toBeVisible()
    await expect.element(page.getByRole('button', { name: /^Calendar$/ })).not.toBeInTheDocument()
    await view.unmount()
  })
})
