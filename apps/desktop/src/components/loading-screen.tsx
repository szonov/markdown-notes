import type { ReactElement } from 'react'
import { useI18n } from '@/providers/i18n-provider.tsx'

export function LoadingScreen(): ReactElement {
  const { t } = useI18n()
  return (
    <div
      role="status"
      className="flex h-full items-center justify-center p-6 text-sm text-text-muted"
    >
      {t('Loading…')}
    </div>
  )
}
