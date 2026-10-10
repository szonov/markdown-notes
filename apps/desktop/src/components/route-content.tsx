import { lazy, Suspense, type ReactElement } from 'react'
import { DailyNoteView } from '@/components/daily-note-view.tsx'
import { DailyStream } from '@/components/daily-stream.tsx'
import { LoadingScreen } from '@/components/loading-screen.tsx'
import { SearchRoute } from '@/components/search-route.tsx'
import { SingleNoteView } from '@/components/single-note-view.tsx'
import { useRouter } from '@/routing/router.tsx'
import { useToday } from '@/lib/use-today.ts'
import { useSettings } from '@/providers/settings-provider.tsx'

const AllNotesScreen = lazy(async () => {
  const { AllNotesScreen } = await import('@/components/all-notes/all-notes-screen.tsx')
  return { default: AllNotesScreen }
})
const SettingsRoute = lazy(async () => {
  const { SettingsRoute } = await import('@/components/settings/settings-route.tsx')
  return { default: SettingsRoute }
})
const TasksScreen = lazy(async () => {
  const { TasksScreen } = await import('@/components/tasks/tasks-screen.tsx')
  return { default: TasksScreen }
})

/**
 * The route → view mapping (Plan 06): the single place a {@link Route} kind
 * becomes a workspace surface. Daily routes render one day per page; a `note`
 * route renders one ordinary note as a first-class editable pane (lazy,
 * so ⌘N's fresh path opens before any file exists). Extracted from the
 * workspace shell so this seam — the contract that non-daily notes are just as
 * editable as daily ones — is directly testable.
 */
function RouteContentBody(): ReactElement {
  const { route, arrivalFocusEditor } = useRouter()
  const today = useToday()
  const { settings } = useSettings()
  const daily = (date: string, todayRoute = false): ReactElement =>
    settings.dailyNotesView === 'pages' ? (
      <DailyNoteView date={date} autoFocusSelection={arrivalFocusEditor ? 'end' : 'start'} />
    ) : (
      <DailyStream target={todayRoute ? { kind: 'today' } : { kind: 'date', date }} />
    )
  switch (route.kind) {
    case 'today':
      return daily(today, true)
    case 'daily':
      // The router normalizes daily routes (see normalizeRoute), so the date
      // is a real calendar day by the time it reaches a view.
      return daily(route.date)
    case 'note':
      return <SingleNoteView path={route.path} />
    case 'allNotes':
      // Owns its scroll container (virtualized table + fixed header), so no
      // ScrollRestored wrapper — same shape as the daily stream.
      return <AllNotesScreen tag={route.tag} />
    case 'search':
      return <SearchRoute query={route.query} />
    case 'tasks':
      return <TasksScreen />
    case 'graphs':
    // The graph-switcher route is a mobile settings sub-screen; on desktop
    // graph switching lives in the sidebar footer, so it renders as settings.
    case 'settings':
      return <SettingsRoute />
  }
}

export function RouteContent(): ReactElement {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RouteContentBody />
    </Suspense>
  )
}
