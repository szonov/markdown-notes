import type { ReactElement } from 'react'
import { keybindingFor, newNoteRoute } from '@/lib/commands/app-commands.ts'
import { formatBindingLabel } from '@/lib/keybindings.ts'
import { useRouter } from '@/routing/router.tsx'
import { useI18n } from '@/providers/i18n-provider.tsx'

const NEW_NOTE_BINDING = keybindingFor('note.new')

/**
 * The All Notes header's primary action — the same fresh-note route as ⌘N
 * (created lazily on the first keystroke), with the binding taught inline.
 */
export function NewNoteButton(): ReactElement {
  const { navigate } = useRouter()
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={() => navigate(newNoteRoute())}
      className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-text-on-brand shadow-sm transition-colors duration-100 hover:bg-accent-hover"
    >
      {t('New note')}
      {NEW_NOTE_BINDING !== null ? (
        <span aria-hidden className="rounded bg-white/20 px-1 py-px text-[11px] font-medium">
          {formatBindingLabel(NEW_NOTE_BINDING)}
        </span>
      ) : null}
    </button>
  )
}
