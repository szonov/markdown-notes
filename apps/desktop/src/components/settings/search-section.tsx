import type { ReactElement } from 'react'
import { RebuildIndexField } from './rebuild-index-field.tsx'
import { SettingsSection } from './section.tsx'

/** Search-index maintenance settings. */
export function SearchSection(): ReactElement {
  return (
    <SettingsSection id="search">
      <RebuildIndexField />
    </SettingsSection>
  )
}
