import type { ReactElement } from 'react'
import { Folder, FolderPlus } from 'lucide-react'
import { InlineAlert } from '@/components/inline-alert.tsx'
import { Button } from '@/components/ui/button.tsx'
import { useGraphColors } from '@/hooks/use-graph-colors.ts'
import { graphColorCss } from '@/lib/graph-colors.ts'
import { cn } from '@/lib/utils.ts'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useI18n } from '@/providers/i18n-provider.tsx'

/** Opens a local Markdown folder and keeps a short list of recent folders. */
export function GraphChooser(): ReactElement {
  const { recents, error, pickAndOpen, openRecent, forget } = useGraph()
  const { colorFor } = useGraphColors()
  const { t } = useI18n()

  return (
    <div className="flex h-screen w-screen overflow-auto bg-surface-app p-8">
      <div className="m-auto w-full max-w-md space-y-8">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            {t('Welcome to Markdown Notes')}
          </h1>
          <p className="text-sm text-text-secondary">
            {t('Your notes are plain Markdown files in a folder you choose.')}
          </p>
        </div>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-text-secondary">
              <Folder aria-hidden className="size-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-base font-semibold text-text">{t('Local Markdown folder')}</h2>
              <p className="text-sm text-text-secondary">
                {t('Open an existing folder or choose an empty folder for a new collection of notes.')}
              </p>
            </div>
          </div>
          <Button type="button" className="w-full" onClick={() => void pickAndOpen()}>
            <FolderPlus aria-hidden strokeWidth={1.75} />
            {t('Choose a folder…')}
          </Button>
        </section>

        {error ? (
          <InlineAlert tone="error" className="text-center">
            {error}
          </InlineAlert>
        ) : null}

        {recents.length > 0 ? (
          <div className="space-y-2">
            <p className="px-2 text-2xs font-medium tracking-wide text-text-muted">{t('Recent')}</p>
            <ul className="space-y-px">
              {recents.map((recent) => {
                const color = colorFor(recent.root)
                return (
                  <li
                    key={recent.root}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover"
                  >
                    <button
                      type="button"
                      onClick={() => void openRecent(recent.root)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <Folder
                        aria-hidden
                        strokeWidth={1.75}
                        className={cn('size-4 shrink-0', color === undefined && 'text-text-muted')}
                        style={color === undefined ? undefined : { color: graphColorCss(color) }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text">
                          {recent.name}
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          {recent.root}
                        </span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => void forget(recent.root)}
                      aria-label={`${t('Forget')} ${recent.name}`}
                      className="shrink-0 text-text-muted opacity-0 transition-opacity duration-100 hover:text-text-secondary group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100"
                    >
                      {t('Forget')}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
