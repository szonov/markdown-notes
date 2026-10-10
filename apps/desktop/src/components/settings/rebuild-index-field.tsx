import { useState, type ReactElement } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { rebuildIndexVisibly } from '@/lib/rebuild-index.ts'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useI18n } from '@/providers/i18n-provider.tsx'
import { SettingsField } from './field.tsx'

/**
 * The recovery lever for the local index: a one-click full rebuild from the
 * markdown files (the same action as the palette's "Rebuild search index").
 * Progress and failures surface through the operations status UI. The local
 * in-flight state only drives the label and disabled treatment —
 * rebuildIndexVisibly itself coalesces overlapping requests, including races
 * with the palette command.
 */
export function RebuildIndexField(): ReactElement {
  const { indexGeneration } = useGraph()
  const { t } = useI18n()
  const [rebuilding, setRebuilding] = useState(false)

  const rebuild = async (): Promise<void> => {
    if (indexGeneration === null || rebuilding) {
      return
    }
    setRebuilding(true)
    try {
      await rebuildIndexVisibly(indexGeneration)
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <SettingsField
      legend={t('Rebuild index')}
      description={t('Markdown Notes keeps a local index of your notes to power search and links. If results ever look stale or incomplete, rebuild it — your notes are never changed.')}
    >
      <div className="mt-3 flex justify-start">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={indexGeneration === null || rebuilding}
          onClick={() => void rebuild()}
          className="text-text-secondary"
        >
          {rebuilding ? t('Rebuilding…') : t('Rebuild index')}
        </Button>
      </div>
    </SettingsField>
  )
}
