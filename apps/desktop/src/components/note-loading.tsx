import type { ReactElement } from 'react'
import { cn } from '@/lib/utils.ts'
import { useI18n } from '@/providers/i18n-provider.tsx'

/** Placeholder while a note document loads. */
export function NoteLoading({ className }: { className?: string }): ReactElement {
  const { t } = useI18n()
  // `reflect-note-loading` keeps the hint invisible for the first beat:
  // local reads resolve in milliseconds, and the text flashing on every
  // daily-stream row reads as flicker while the stream anchors.
  return (
    <div className={cn('reflect-note-loading px-1 py-2 text-sm text-text-muted', className)}>
      {t('Loading note…')}
    </div>
  )
}
