import type { ReactElement } from 'react'
import { AboutSection } from './settings/about-section.tsx'
import { AllNotesSection } from './settings/all-notes-section.tsx'
import { AppearanceSection } from './settings/appearance-section.tsx'
import { DateTimeSection } from './settings/date-time-section.tsx'
import { DestructiveSection } from './settings/destructive-section.tsx'
import { EditorSection } from './settings/editor-section.tsx'
import { SearchSection } from './settings/search-section.tsx'

/**
 * The settings screen (a routed view, like notes — reached via ⌘, or the
 * palette's "Open settings"). Every control applies instantly through the
 * settings provider; there is no save button.
 */
export function SettingsScreen(): ReactElement {
  return (
    <div aria-label="Settings">
      <h1 className="text-lg font-semibold text-text">Settings</h1>
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
