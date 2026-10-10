import { useDeferredValue, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { parseSearchQuery, searchWithFilters, suggestWikiTargets } from '@reflect/core'
import { useBridgeReady } from '@/hooks/use-bridge-ready.ts'
import { listCommands } from '@/lib/commands/registry.ts'
import { todayIso } from '@/lib/dates.ts'
import { queryKeys } from '@/lib/query-client.ts'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useSettings } from '@/providers/settings-provider.tsx'
import { buildPaletteSections, type PaletteSections } from './entries.ts'
import { useI18n } from '@/providers/i18n-provider.tsx'

/**
 * The palette's data layer (Plan 08), extracted so the component stays
 * presentational: query deferral, filter parsing, the two index queries
 * (title suggestions + the one search path, whose filters may be empty), and
 * the settled/failed accounting the empty-state needs. Plan 09's semantic
 * results join here, not in the component.
 */

export interface PaletteResults {
  sections: PaletteSections
  /** True once the index has answered the *live* query (gates "No results"). */
  resultsSettled: boolean
  /** True when an index read errored — "No results" would be a lie. */
  searchFailed: boolean
}

function localizedCommandTitle(title: string, language: 'en' | 'ru', t: (text: string) => string): string {
  const graphSwitch = /^Switch to graph (\d+)$/.exec(title)
  if (language === 'ru' && graphSwitch?.[1] !== undefined) {
    return `Переключиться на папку ${graphSwitch[1]}`
  }
  return t(title)
}

export function usePaletteResults(open: boolean, query: string): PaletteResults {
  const { language, t } = useI18n()
  const { graph } = useGraph()
  const { settings } = useSettings()

  // Defer the query the index sees: fast typing coalesces (the plan's
  // debounce) while the input itself stays perfectly responsive.
  const trimmed = useDeferredValue(query.trim())
  // Filter tokens (#tag, is:daily, is:pinned, links:, linked-from:, updated:)
  // switch the search into constrained mode (Plan 08b); plain text is the same
  // query with empty filters — one search path.
  const parsed = useMemo(() => parseSearchQuery(trimmed), [trimmed])
  const bridgeReady = useBridgeReady()
  const searching = open && bridgeReady && graph !== null && !trimmed.startsWith('>')
  // The generated date suggestions are relative to today, so the calendar day is
  // part of the cache identity — without it a palette cached before midnight
  // would serve a stale "Tomorrow" afterwards. Computed once so the key and the
  // query agree on the same day.
  const today = todayIso()

  const {
    data: suggestions,
    isLoading: suggestionsLoading,
    isError: suggestionsError,
  } = useQuery({
    queryKey: queryKeys.index.paletteSuggestions(graph?.root, {
      text: trimmed,
      dateFormat: settings.dateFormat,
      weekStartDay: settings.weekStartDay,
      today,
    }),
    queryFn: () =>
      suggestWikiTargets(trimmed, 8, {
        today,
        dateFormat: settings.dateFormat,
        weekStartDay: settings.weekStartDay,
      }),
    enabled: searching && !parsed.filtered,
  })
  const {
    data: hits,
    isLoading: hitsLoading,
    isError: hitsError,
  } = useQuery({
    queryKey: queryKeys.index.paletteSearch(graph?.root, 'lexical', trimmed),
    queryFn: () => searchWithFilters(parsed),
    enabled: searching && trimmed !== '',
  })

  // "No results" must mean the index answered **the live query**: the active
  // fetches settled (isLoading, not isPending — a disabled query is forever
  // pending) *and* the deferred value has caught up. Opening pre-filled, the
  // deferred value can settle on the stale previous query first; that state
  // is "still answering", not "empty".
  const resultsSettled = !suggestionsLoading && !hitsLoading && trimmed === query.trim()
  // An errored query is "settled" to TanStack but not an answer.
  const searchFailed = suggestionsError || hitsError

  const sections = useMemo(
    () =>
      buildPaletteSections({
        query,
        dataQuery: trimmed,
        suggestions: suggestions ?? [],
        hits: hits ?? [],
        filtered: parsed.filtered,
        commands: listCommands().map((command) => ({
          ...command,
          title: localizedCommandTitle(command.title, language, t),
        })),
      }),
    [query, trimmed, suggestions, hits, parsed.filtered, language, t],
  )

  return { sections, resultsSettled, searchFailed }
}
