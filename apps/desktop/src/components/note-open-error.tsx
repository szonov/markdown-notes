import type { ReactElement } from 'react'
import { cn } from '@/lib/utils.ts'
import { useI18n } from '@/providers/i18n-provider.tsx'

interface NoteOpenErrorProps {
  path: string
  message: string | null
  className?: string
}

/** A note document that failed its initial load. */
export function NoteOpenError({ path, message, className }: NoteOpenErrorProps): ReactElement {
  const { t } = useI18n()
  return (
    <div role="alert" className={cn('px-1 py-2 text-sm text-red-500', className)}>
      {t('Couldn’t open')} {path}: {message}
    </div>
  )
}
