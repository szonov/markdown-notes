import type { ReactElement } from 'react'
import { dailyPath } from '@reflect/core'
import { SingleNoteView } from '@/components/single-note-view.tsx'
import { formatDayLabel } from '@/lib/dates.ts'
import { cn } from '@/lib/utils.ts'
import { useSettings } from '@/providers/settings-provider.tsx'
import { useToday } from '@/lib/use-today.ts'

interface DailyNoteViewProps {
  /** The one calendar day shown by this page. */
  date: string
  /** Capture-style arrivals (Daily notes / shortcut) append at the end. */
  autoFocusSelection?: 'start' | 'end'
}

/** A daily note as one ordinary page rather than a row in the daily stream. */
export function DailyNoteView({
  date,
  autoFocusSelection = 'start',
}: DailyNoteViewProps): ReactElement {
  const { settings } = useSettings()
  const today = useToday()

  return (
    <SingleNoteView
      key={date}
      path={dailyPath(date)}
      dailyDate={date}
      autoFocusSelection={autoFocusSelection}
      heading={
        <h2
          className={cn(
            'reflect-daily-subject reflect-content-gutter mb-3',
            date === today && 'text-accent',
          )}
        >
          {formatDayLabel(date, settings.dateFormat)}
        </h2>
      }
    />
  )
}
