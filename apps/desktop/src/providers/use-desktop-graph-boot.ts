import { useEffect } from 'react'
import { isMobilePlatform, type AppPlatform, type RecentGraph } from '@reflect/core'
import { isMainWindow } from '@/lib/windows/window-role.ts'

/** The graph provider's channels for the desktop main-window boot leg. */
export interface DesktopGraphBootOptions {
  platform: AppPlatform
  /** Refresh the recents list, surfacing read errors (this is the primary load). */
  loadRecents: (options?: { surfaceErrors?: boolean }) => Promise<RecentGraph[]>
  /** Open a graph by root; resolves once the open settles either way. */
  openRecent: (root: string) => Promise<boolean>
  /** No recents to reopen — park on the chooser. */
  onChoose: () => void
}

/**
 * Desktop main-window boot: reopen the most recent graph so the app resumes
 * where the user left off, or park on the chooser. One of GraphProvider's
 * three boot legs — the mobile fixed-root boot (`useMobileGraphBoot`) and
 * note-window session adoption (`useNoteWindowBoot`) are the others; exactly
 * one runs per window, decided here by platform and window role.
 */
export function useDesktopGraphBoot({
  platform,
  loadRecents,
  openRecent,
  onChoose,
}: DesktopGraphBootOptions): void {
  useEffect(() => {
    if (isMobilePlatform(platform) || !isMainWindow()) {
      return
    }
    let active = true
    void (async () => {
      const list = await loadRecents({ surfaceErrors: true })
      if (!active) {
        return
      }
      if (list.length > 0) {
        // Menu order is stable because it defines ⌘1…⌘9. Resume the
        // actually most recently opened graph by timestamp without reordering it.
        const mostRecent = list.reduce((latest, candidate) =>
          candidate.openedMs > latest.openedMs ? candidate : latest,
        )
        await openRecent(mostRecent.root)
      } else {
        onChoose()
      }
    })()
    return () => {
      active = false
    }
  }, [platform, loadRecents, openRecent, onChoose])
}
