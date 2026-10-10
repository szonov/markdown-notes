import type { ReactElement } from 'react'
import { InlineAlert } from '@/components/inline-alert.tsx'
import { NoteConflictBanner } from '@/components/note-conflict-banner.tsx'
import type { AssetSaveError } from '@/editor/use-asset-persistence.ts'
import type { NoteDocument } from '@/editor/use-note-document.ts'
import { useI18n } from '@/providers/i18n-provider.tsx'

interface NoteSaveAlertsProps {
  document: NoteDocument
  /** A pasted image or dropped file that could not be saved. */
  assetSaveError?: AssetSaveError | null
}

/** What went wrong saving a ready document, and the external-change conflict prompt. */
export function NoteSaveAlerts({
  document,
  assetSaveError = null,
}: NoteSaveAlertsProps): ReactElement {
  const { t } = useI18n()
  return (
    <>
      {document.error !== null ? (
        <InlineAlert tone="error" className="mb-4">
          {t('Saving failed:')} {document.error}.{' '}
          {t('Your edits are kept in the editor and the next successful save will persist them.')}
        </InlineAlert>
      ) : null}
      {assetSaveError !== null ? (
        <InlineAlert tone="error" className="mb-4">
          {t('Couldn’t save the')} {t(assetSaveError.kind === 'image' ? 'pasted image' : 'file')}:{' '}
          {assetSaveError.message}. {t('It was not added to the note.')}
        </InlineAlert>
      ) : null}
      {document.conflict !== null ? (
        <NoteConflictBanner onKeepMine={document.keepMine} onLoadTheirs={document.loadTheirs} />
      ) : null}
    </>
  )
}
