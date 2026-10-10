import { toast } from '@/components/ui/toast.tsx'
import { getOperations, subscribeOperations, type Operation } from '@/lib/operations.ts'
import type { Translate } from '@/providers/i18n-provider.tsx'

/**
 * The desktop face of the operations store (foundations hardening): a small,
 * unobtrusive toast stack for background operations that outlive their pane —
 * the rename rewrite is the first tenant; indexing/sync states can migrate
 * here as they're touched. Mobile renders the same store as pills instead
 * ({@link MobileOperationsPills}).
 *
 * A plain subscriber, not a React component: store listeners run synchronously
 * inside the mutation that reported the event (`startOperation`, `handle.fail`,
 * ...), so every toast call happens in the originating event handler's own
 * call stack rather than in a render-then-effect cycle.
 */

// `timeout: 0` disables Base UI's auto-dismiss (the store owns lingering and
// removal); the dismissible flag hides the close button and disables
// swipe-to-dismiss (see `ToastData` in `ui/toast.tsx`).
const NON_DISMISSIBLE_OPERATION_OPTIONS = {
  timeout: 0,
  data: { dismissible: false },
}

function toastId(operation: Operation): string {
  return `operation-${operation.id}`
}

function descriptionFor(operation: Operation, t: Translate): string | undefined {
  if (operation.status !== 'running' && operation.message !== null) {
    return t(operation.message)
  }
  if (operation.progress !== null) {
    return `${operation.progress.done}/${operation.progress.total}`
  }
  return operation.description !== null ? t(operation.description) : undefined
}

function showOperationToast(operation: Operation, t: Translate): void {
  const operationAction = operation.action
  const actionProps = operationAction
    ? {
        children: t(operationAction.label),
        onClick: () => {
          void Promise.resolve(operationAction.run()).catch((error: unknown) => {
            console.error('operation action failed:', error)
          })
        },
      }
    : undefined
  const options = {
    id: toastId(operation),
    title: t(operation.label),
    description: descriptionFor(operation, t),
    ...NON_DISMISSIBLE_OPERATION_OPTIONS,
    actionProps,
  }

  switch (operation.status) {
    case 'failed':
      toast.add({ ...options, type: 'error' })
      break
    case 'warning':
      toast.add({ ...options, type: 'warning' })
      break
    case 'running':
      // Explicit undefined clears a stale error/warning icon if the same
      // operation id returns to running (`add()` merges by id).
      toast.add({ ...options, type: undefined })
      break
  }
}

/** Start mirroring the operations store into toasts; returns a detach. */
export function attachOperationToasts(t: Translate = (text) => text): () => void {
  let shownIds = new Set<number>()
  const sync = (): void => {
    const operations = getOperations()
    const nextIds = new Set(operations.map((operation) => operation.id))
    for (const id of shownIds) {
      if (!nextIds.has(id)) {
        toast.close(`operation-${id}`)
      }
    }
    for (const operation of operations) {
      showOperationToast(operation, t)
    }
    shownIds = nextIds
  }
  sync()
  return subscribeOperations(sync)
}
