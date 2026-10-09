import { useEffect, type ReactElement } from 'react'
import { usePalette } from '@/components/command-palette/palette-provider.tsx'
import { DailyNoteView } from '@/components/daily-note-view.tsx'
import { DailyStream } from '@/components/daily-stream.tsx'
import { useToday } from '@/lib/use-today.ts'
import { useSettings } from '@/providers/settings-provider.tsx'
import { useRouter } from '@/routing/router.tsx'

interface SearchRouteProps {
  /** The query carried by the `search/:query` route. */
  query: string
}

/**
 * `search/:query` is a deep-link target, not a second search surface (decided
 * 2026-06-09): arriving opens the ⌘K palette pre-filled over the stream.
 */
export function SearchRoute({ query }: SearchRouteProps): ReactElement {
  const { openPalette } = usePalette()
  const { arrivalSeq, entryId } = useRouter()
  const today = useToday()
  const { settings } = useSettings()
  // Keyed on the *arrival*, not just the value (the daily stream's lesson):
  // re-navigating to the same search route bumps arrivalSeq without a remount,
  // and back/forward changes entryId without bumping arrivalSeq — both are
  // arrivals, and arriving on search opens the palette (decided).
  useEffect(() => {
    openPalette(query)
  }, [query, arrivalSeq, entryId, openPalette])
  return settings.dailyNotesView === 'pages' ? (
    <DailyNoteView date={today} />
  ) : (
    <DailyStream target={{ kind: 'today' }} />
  )
}
