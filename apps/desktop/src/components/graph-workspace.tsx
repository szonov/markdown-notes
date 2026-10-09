import type { ReactElement } from 'react'
import type { GraphInfo } from '@reflect/core'
import { PaletteProvider } from '@/components/command-palette/palette-provider.tsx'
import { NoteWindowContent } from '@/components/note-window-content.tsx'
import { WorkspaceContent } from '@/components/workspace-content.tsx'
import { getInitialWindowRoute } from '@/lib/windows/initial-window-route.ts'
import { isMainWindow } from '@/lib/windows/window-role.ts'
import { useAttachmentCatalogSync } from '@/lib/attachment-catalog.ts'
import { FocusedDailyProvider } from '@/providers/focused-daily-provider.tsx'
import { DeepLinkProvider } from '@/providers/deep-link-provider.tsx'
import { NoteFindProvider } from '@/providers/note-find-provider.tsx'
import { ShortcutsProvider } from '@/providers/shortcuts-provider.tsx'
import { SidebarProvider } from '@/providers/sidebar-provider.tsx'
import { RouterProvider } from '@/routing/router.tsx'

interface GraphWorkspaceProps {
  graph: GraphInfo
}

/**
 * The main surface once a graph is open (Plan 06): mounts the per-graph
 * providers — the typed router, the ⌘K palette, and the sidebar state —
 * around {@link WorkspaceContent}. The app opens to today's daily note, the
 * chronological spine. Keyed by the graph root so switching graphs starts a
 * fresh history.
 */
export function GraphWorkspace({ graph }: GraphWorkspaceProps): ReactElement {
  useAttachmentCatalogSync(graph.generation)
  // A note window's first route is its ⌘-clicked target (seeded by the boot
  // hook) — starting on the default today route would flash the daily note
  // until the deep link navigated.
  const initialRoute = isMainWindow() ? null : getInitialWindowRoute()
  return (
    <RouterProvider key={graph.root} {...(initialRoute !== null ? { initialRoute } : {})}>
      <PaletteProvider>
        <ShortcutsProvider>
          <SidebarProvider>
            <DeepLinkProvider graph={graph}>
              {/* Tracks the focused day in the daily stream so the right
                              sidebar describes it, not just the routed day. */}
              <FocusedDailyProvider>
                <NoteFindProvider>
                  {/* A ⌘-clicked note window is chrome-free: the
                                  routed view only, no sidebar/palette shell.
                                  The V1 import lives above the routed views so
                                  closing settings can't orphan a running
                                  import; main window only — its dialog is the
                                  import's single face. */}
                  {isMainWindow() ? <WorkspaceContent graph={graph} /> : <NoteWindowContent />}
                </NoteFindProvider>
              </FocusedDailyProvider>
            </DeepLinkProvider>
          </SidebarProvider>
        </ShortcutsProvider>
      </PaletteProvider>
    </RouterProvider>
  )
}
