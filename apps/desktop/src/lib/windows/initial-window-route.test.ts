import { beforeEach, describe, expect, it } from 'vitest'
import {
  getInitialWindowRoute,
  initialRouteForDeepLink,
  resetInitialWindowRouteForTests,
  setInitialWindowRoute,
} from './initial-window-route.ts'

beforeEach(resetInitialWindowRouteForTests)

describe('initialRouteForDeepLink', () => {
  it('derives navigate links directly', () => {
    expect(initialRouteForDeepLink('markdown-notes://daily/2026-07-05')).toEqual({
      kind: 'daily',
      date: '2026-07-05',
    })
    expect(initialRouteForDeepLink('markdown-notes://today')).toEqual({ kind: 'today' })
  })

  it('derives path-shaped note targets without the index', () => {
    // ⌘-click builds these via deepLinkForRoute, so the target IS the path.
    expect(initialRouteForDeepLink('markdown-notes://note/notes%2Ffoo.md')).toEqual({
      kind: 'note',
      path: 'notes/foo.md',
    })
    // A daily path routes to the daily view, same as routeForPath everywhere.
    expect(initialRouteForDeepLink('markdown-notes://note/daily%2F2026%2F2026-07-04.md')).toEqual({
      kind: 'daily',
      date: '2026-07-04',
    })
  })

  it('declines targets only the index can answer', () => {
    expect(initialRouteForDeepLink('markdown-notes://note/Meeting%20Notes')).toBeNull()
    expect(initialRouteForDeepLink('markdown-notes://note/01hzx4abc')).toBeNull()
  })

  it('declines capture links, garbage, and absence', () => {
    expect(initialRouteForDeepLink('markdown-notes://append?text=hi')).toBeNull()
    expect(initialRouteForDeepLink('not a url')).toBeNull()
    expect(initialRouteForDeepLink(null)).toBeNull()
  })
})

describe('the initial-route slot', () => {
  it('holds the seeded route for the workspace mount', () => {
    expect(getInitialWindowRoute()).toBeNull()
    setInitialWindowRoute({ kind: 'note', path: 'notes/foo.md' })
    expect(getInitialWindowRoute()).toEqual({ kind: 'note', path: 'notes/foo.md' })
    // Idempotent reads: StrictMode double-invokes initializers.
    expect(getInitialWindowRoute()).toEqual({ kind: 'note', path: 'notes/foo.md' })
  })
})
