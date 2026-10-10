import type { ReactElement } from 'react'
import { Keyboard } from 'lucide-react'
import { ShortcutKeys } from '@/components/shortcut-keys.tsx'
import { Button } from '@/components/ui/button.tsx'
import { keybindingFor } from '@/lib/commands/app-commands.ts'
import { useShortcuts } from '@/providers/shortcuts-provider.tsx'
import { useI18n } from '@/providers/i18n-provider.tsx'

const SHORTCUTS_BINDING = keybindingFor('shortcuts.show')

export function KeyboardShortcutsField(): ReactElement {
  const { openShortcuts } = useShortcuts()
  const { t } = useI18n()

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{t('Keyboard shortcuts')}</div>
        <p className="mt-0.5 text-xs text-text-muted">{t('Show every app and editor shortcut.')}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {SHORTCUTS_BINDING !== null ? (
          <ShortcutKeys binding={SHORTCUTS_BINDING} className="hidden sm:flex" />
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={openShortcuts}>
          <Keyboard aria-hidden data-icon="inline-start" strokeWidth={1.75} />
          {t('Show all')}
        </Button>
      </div>
    </div>
  )
}
