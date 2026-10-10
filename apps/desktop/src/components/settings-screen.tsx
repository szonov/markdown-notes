import type { ReactElement } from 'react'
import { AboutSection } from './settings/about-section.tsx'
import { AllNotesSection } from './settings/all-notes-section.tsx'
import { AppearanceSection } from './settings/appearance-section.tsx'
import { DateTimeSection } from './settings/date-time-section.tsx'
import { DestructiveSection } from './settings/destructive-section.tsx'
import { EditorSection } from './settings/editor-section.tsx'
import { SearchSection } from './settings/search-section.tsx'
import { useI18n } from '@/providers/i18n-provider.tsx'

/**
 * The settings screen (a routed view, like notes — reached via ⌘, or the
 * palette's "Open settings"). Every control applies instantly through the
 * settings provider; there is no save button.
 */
export function SettingsScreen(): ReactElement {
  const { t } = useI18n()
  return (
    <div aria-label={t('Settings')}>
      <h1 className="text-lg font-semibold text-text">{t('Settings')}</h1>
      <div className="mt-6">
        <AppearanceSection />
        <EditorSection />
        <DateTimeSection />
        <AllNotesSection />
        <SearchSection />
        <AboutSection />
        <DestructiveSection />
      </div>
    </div>
  )
}
