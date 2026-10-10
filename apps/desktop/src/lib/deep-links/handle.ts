import { errorMessage, resolveNoteTarget } from '@reflect/core'
import { startOperation } from '@/lib/operations.ts'
import { routeForPath, type Route } from '@/routing/route.ts'
import { parseDeepLink } from '@/lib/deep-links/parse.ts'

/** What acting on a deep link needs from the open graph session. */
export interface DeepLinkIo {
  navigate: (route: Route) => void
  /** `GraphInfo.generation` — pins the capture spool to the issuing graph. */
  generation: number
  /**
   * Whether the graph session or navigation intent changed while the handler
   * awaited. Note resolution queries whichever index is open when it runs, so
   * a stale result must be dropped, never navigated — it may name a homonym
   * note in the newly opened graph or override a newer user action. (The
   * capture path needs no gate: the spool write is generation-pinned in Rust
   * and fails loudly when stale.)
   */
  isStale?: () => boolean
}

/**
 * Act on one incoming `markdown-notes://` URL: navigation links navigate (a note
 * target resolving through the index first), capture links spool an envelope
 * into `.reflect/inbox/` for the watcher-triggered drain to materialize.
 * Every outcome that isn't a navigation surfaces on the operations status
 * line — an outside-world input must never crash or silently vanish.
 */
export async function handleDeepLink(url: string, io: DeepLinkIo): Promise<void> {
  const link = parseDeepLink(url)
  if (link === null) {
    startOperation('Opening link').fail(`Unrecognized link: ${truncate(url)}`)
    return
  }
  switch (link.kind) {
    case 'navigate':
      io.navigate(link.route)
      return
    case 'openNote': {
      let path: string | null
      try {
        path = await resolveNoteTarget(link.target)
      } catch (cause) {
        if (io.isStale?.() === true) {
          return
        }
        startOperation('Opening link').fail(errorMessage(cause))
        return
      }
      if (io.isStale?.() === true) {
        return // the graph switched mid-resolve; the result answers the wrong graph
      }
      if (path === null) {
        startOperation('Opening link').fail(`Note not found: ${truncate(link.target)}`)
        return
      }
      io.navigate(routeForPath(path))
      return
    }
  }
}

/** Status-line-sized excerpt of an untrusted URL or target. */
function truncate(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}…` : value
}
