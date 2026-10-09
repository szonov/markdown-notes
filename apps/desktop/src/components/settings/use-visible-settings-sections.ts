import { useMemo } from 'react'
import { SETTINGS_SECTIONS } from './sections.ts'

/** One registered settings section (see {@link SETTINGS_SECTIONS}). */
export type SettingsSectionEntry = (typeof SETTINGS_SECTIONS)[number]

/**
 * The settings sections this platform actually shows. Integrations
 * only exists where the OS frameworks do (macOS/iOS — the Rust shell answers
 * `unavailable` elsewhere). Agents is macOS-only. The navigator must agree
 * with the page, so both filter through here rather than reading the registry
 * directly.
 */
export function useVisibleSettingsSections(): readonly SettingsSectionEntry[] {
  return useMemo(() => {
    const visible = new Set([
      'appearance',
      'editor',
      'date-time',
      'all-notes',
      'search',
      'about',
      'destructive',
    ])
    return SETTINGS_SECTIONS.filter((section) => visible.has(section.id))
  }, [])
}
