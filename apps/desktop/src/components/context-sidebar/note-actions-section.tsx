import type { ReactElement } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PinIcon } from '@/components/icons/pin-icon.tsx'
import { usePinnedNotes } from '@/hooks/use-pinned-notes.ts'
import { keybindingFor } from '@/lib/commands/app-commands.ts'
import { toggleNotePinned } from '@/lib/note-pin.ts'
import { useGraph } from '@/providers/graph-provider.tsx'
import { NoteActionButton } from './note-action-button.tsx'
import { NoteTrashAction } from './note-trash-action.tsx'
import { SidebarSection } from './sidebar-section.tsx'

interface NoteActionsSectionProps {
  /** Graph-relative path of the note the actions operate on. */
  path: string
  /** Whether this context can offer deleting the note. Daily sidebars leave this off. */
  showTrash?: boolean
}

// Derived from the command definitions so the hints can never drift from the
// real bindings (the same contract as the Today hint).
const PIN_KEYBINDING = keybindingFor('note.togglePin')

/**
 * "Note actions" as a context-sidebar section: mouse-reachable counterparts
 * to the note-scoped commands — pin/unpin and the `private` flag. Shared by
 * the daily and note context sidebars; dailies are valid targets for both.
 * Pin reads the shared shelf cache, updated immediately by every pin entrypoint.
 * Privacy reads the note row cache shared by the palette and mobile actions.
 */
export function NoteActionsSection({
  path,
  showTrash = false,
}: NoteActionsSectionProps): ReactElement {
  const isPinned = usePinnedNotes().some((note) => note.path === path)
  const { graph } = useGraph()
  const queryClient = useQueryClient()
  const togglePin = async (): Promise<void> => {
    if (graph !== null) {
      await toggleNotePinned({
        queryClient,
        root: graph.root,
        generation: graph.generation,
        path,
      })
    }
  }

  return (
    <SidebarSection storageKey="note-actions" title="Note actions">
      <NoteActionButton
        isActive={isPinned}
        onClick={togglePin}
        icon={<PinIcon width={20} height={20} />}
        labels={{ active: 'Un-pin this note', inactive: 'Pin this note' }}
        keybinding={PIN_KEYBINDING}
      />
      {showTrash ? <NoteTrashAction path={path} /> : null}
    </SidebarSection>
  )
}
