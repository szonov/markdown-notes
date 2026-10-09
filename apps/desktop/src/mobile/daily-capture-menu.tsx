import type { ReactElement } from 'react'
import { untitledNotePath } from '@reflect/core'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import { hapticImpactLight } from '@/mobile/haptics.ts'
import { useRouter } from '@/routing/router.tsx'

/**
 * The Daily screen's compact capture speed dial. The persistent `+` expands
 * into new-note and audio-memo actions along one anchored vertical path. The
 * action wrappers remain mounted so a rapid second tap reverses from their
 * live on-screen transforms instead of restarting or jumping.
 */
export function DailyCaptureMenu(): ReactElement {
  const { navigate } = useRouter()

  const createNote = (): void => {
    hapticImpactLight()
    navigate({ kind: 'note', path: untitledNotePath() })
  }

  return (
    <div
      className="fixed right-4 z-40 size-12"
      style={{
        bottom: 'calc(max(env(safe-area-inset-bottom), var(--keyboard-height, 0px)) + 4.25rem)',
      }}
    >
      <Button
        size="icon"
        aria-label="New note"
        className="size-12 rounded-full shadow-lg"
        onClick={createNote}
      >
        <span aria-hidden className="flex">
          <Plus className="size-6" />
        </span>
      </Button>
    </div>
  )
}
