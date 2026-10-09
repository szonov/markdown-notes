import { useEffect, type ReactElement } from 'react'
import { installBackgroundFlush } from '@/lib/background-flush.ts'
import { AppErrorBoundary } from '@/components/app-error-boundary.tsx'
import { MobileShell } from '@/mobile/mobile-shell.tsx'
import { MobileStatusLayer } from '@/mobile/status-layer.tsx'
import {
  useKeyboardCaretReveal,
  useKeyboardFieldReveal,
  useKeyboardHeightVar,
} from '@/mobile/use-keyboard.ts'
import { useTaskCheckboxHaptics } from '@/mobile/use-task-haptics.ts'
import { useAttachmentCatalogSync } from '@/lib/attachment-catalog.ts'
import { useGraph } from '@/providers/graph-provider.tsx'
import { RouterProvider } from '@/routing/router.tsx'

/**
 * Mobile root component (Plan 19): the graph provider bootstraps the fixed
 * `Documents/` root automatically, so there is no chooser — just a loading
 * gate into the route switch. `choosing` only happens when that open failed
 * (the provider parks there with its error), so it renders as an error state.
 *
 * The router mounts per graph exactly as on desktop; `MobileScreen` renders
 * the current route (daily spine, note pages), so wiki-link and date-link
 * taps navigate for real. The keyboard-height mirror lives here so every
 * screen inherits `--keyboard-height`; the field/caret reveals and the
 * checkbox-haptic listener mount here so they cover every screen's inputs.
 */
export function MobileApp(): ReactElement {
  const { status, graph, error } = useGraph()
  useKeyboardHeightVar()
  useKeyboardFieldReveal()
  useKeyboardCaretReveal()
  useTaskCheckboxHaptics()
  // iCloud graphs have an out-of-process writer (the OS syncing files in):
  // nudge downloads + re-reconcile on resume. Inert for local/git graphs.
  useAttachmentCatalogSync(graph?.generation ?? null)

  // Flush-on-background (Plan 19, decision 6): iOS may suspend or kill the
  // process soon after backgrounding, so every hide lands dirty note buffers
  // and settings, then makes a local backup commit. Installed unconditionally
  // (each flush is a no-op with nothing open) — the mobile leg of desktop's
  // quit-flush.
  useEffect(() => {
    return installBackgroundFlush()
  }, [])

  // Subscription verification runs beside startup, never in its critical
  // path: while StoreKit or settings are unresolved the gate stays hidden and
  // the local app boots normally. A settled negative answer can replace the
  // current surface with the paywall later; a purchase lifts it.
  if (status === 'ready' && graph) {
    return (
      <AppErrorBoundary>
        <RouterProvider key={graph.root}>
          <MobileShell />
          <MobileStatusLayer />
        </RouterProvider>
      </AppErrorBoundary>
    )
  }

  if (status === 'choosing') {
    return (
      <div className="flex h-dvh w-screen flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm font-medium">Couldn’t open your notes</p>
        <p className="text-sm text-text-muted">{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  return <LoadingScreen />
}

function LoadingScreen(): ReactElement {
  return (
    <div className="flex h-dvh w-screen items-center justify-center text-sm text-text-muted">
      Loading…
    </div>
  )
}
