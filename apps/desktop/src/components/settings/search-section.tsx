import type { ReactElement } from 'react'
import { RebuildIndexField } from './rebuild-index-field.tsx'
import { SettingsSection } from './section.tsx'

/**
 * The search settings: the semantic-search opt-in (Plan 09) and the index
 * rebuild action. Enabling semantic search persists `semanticSearchEnabled`;
 * EmbeddingsSync reacts by loading the model, and the first load's ~90MB
 * download streams through this section as a progress bar (the `embed:status`
 * events carry byte counts).
 */
export function SearchSection(): ReactElement {
  return (
    <SettingsSection id="search">
      <RebuildIndexField />
    </SettingsSection>
  )
}
