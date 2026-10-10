import { useState, type ReactElement } from 'react'
import { errorMessage } from '@reflect/core'
import { getIsComposing } from '@meowdown/core'
import { Button } from '@/components/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog.tsx'
import { Input } from '@/components/ui/input.tsx'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useI18n } from '@/providers/i18n-provider.tsx'
import { SettingsField } from './field.tsx'
import { SettingsSection } from './section.tsx'

export function DestructiveSection(): ReactElement {
  const { graph, forget, deleteGraph } = useGraph()
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [forgetting, setForgetting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteName, setDeleteName] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const graphId = graph?.root ?? t('this graph')
  const graphName = graph?.name ?? ''
  // GitHub-style guard: the delete button stays dead until the typed name
  // matches the graph's folder name exactly.
  const nameConfirmed = graph !== null && deleteName === graph.name

  const forgetGraph = async (): Promise<void> => {
    if (graph === null || forgetting) {
      return
    }
    setForgetting(true)
    try {
      await forget(graph.root)
      setConfirming(false)
    } finally {
      setForgetting(false)
    }
  }

  const openDeleteDialog = (): void => {
    setDeleteName('')
    setDeleteError(null)
    setConfirmingDelete(true)
  }

  const deleteGraphToTrash = async (): Promise<void> => {
    if (!nameConfirmed || deleting) {
      return
    }
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteGraph()
      setConfirmingDelete(false)
    } catch (err) {
      setDeleteError(errorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <SettingsSection id="destructive">
        <SettingsField legend={t('Saved folder')} description={t('Forget this folder. Files stay on disk.')}>
          <div className="mt-3 flex justify-start">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={graph === null || forgetting}
              onClick={() => setConfirming(true)}
            >
              {t('Forget folder')}
            </Button>
          </div>
        </SettingsField>
        <SettingsField
          legend={t('Delete folder')}
          description={t('Move the entire selected folder and everything inside it to Trash.')}
        >
          <div className="mt-3 flex justify-start">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={graph === null || deleting}
              onClick={openDeleteDialog}
            >
              {t('Delete folder')}
            </Button>
          </div>
        </SettingsField>
      </SettingsSection>

      <Dialog open={confirming} onOpenChange={(open) => !forgetting && setConfirming(open)}>
        <DialogContent>
          <DialogTitle>{t('Forget folder?')}</DialogTitle>
          <DialogDescription className="min-w-0">
            {t('Remove')}{' '}
            <span className="font-mono text-text [overflow-wrap:anywhere]">{graphId}</span>{' '}
            {t('from saved folders. Files stay on disk.')}
          </DialogDescription>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="ghost" disabled={forgetting}>
                  {t('Cancel')}
                </Button>
              }
            />
            <Button variant="destructive" disabled={forgetting} onClick={() => void forgetGraph()}>
              {forgetting ? t('Forgetting…') : t('Forget folder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmingDelete}
        onOpenChange={(open) => !deleting && setConfirmingDelete(open)}
      >
        <DialogContent>
          <DialogTitle>{t('Delete folder?')}</DialogTitle>
          <DialogDescription className="min-w-0">
            {t('Move the entire selected folder')}{' '}
            <span className="font-mono text-text [overflow-wrap:anywhere]">{graphId}</span>{' '}
            {t('and everything inside it to Trash. Type')}{' '}
            <span className="font-mono text-text">{graphName}</span> {t('to confirm.')}
          </DialogDescription>
          <Input
            aria-label={t('Folder name')}
            placeholder={graphName}
            value={deleteName}
            autoComplete="off"
            spellCheck={false}
            disabled={deleting}
            onChange={(event) => setDeleteName(event.target.value)}
            onKeyDown={(event) => {
              if (getIsComposing()) {
                return
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                void deleteGraphToTrash()
              }
            }}
          />
          {deleteError !== null && (
            <p role="alert" className="text-xs text-destructive">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="ghost" disabled={deleting}>
                  {t('Cancel')}
                </Button>
              }
            />
            <Button
              variant="destructive"
              disabled={!nameConfirmed || deleting}
              onClick={() => void deleteGraphToTrash()}
            >
              {deleting ? t('Deleting…') : t('Delete folder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
