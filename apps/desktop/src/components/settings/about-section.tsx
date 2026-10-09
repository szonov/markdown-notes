import type { ReactElement } from 'react'
import { useAppVersion } from '@/hooks/use-app-version.ts'
import { SettingsSection } from './section.tsx'

export function AboutSection(): ReactElement {
  const version = useAppVersion()
  return (
    <SettingsSection id="about">
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text">Markdown Notes</div>
        </div>
        <span className="shrink-0 text-sm text-text-secondary">
          {version !== null ? `v${version}` : '—'}
        </span>
      </div>
    </SettingsSection>
  )
}
