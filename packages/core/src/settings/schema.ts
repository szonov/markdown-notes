import { z } from 'zod'

export const editorMarkdownSyntaxSchema = z.enum(['hide', 'show', 'hybrid']).catch('hide')
export type EditorMarkdownSyntax = z.infer<typeof editorMarkdownSyntaxSchema>

export const editorDefaultBulletSchema = z.boolean().catch(true)
export const editorBulletAfterHeadingSchema = z.boolean().catch(true)
export const editorSmoothCaretAnimationSchema = z.boolean().catch(true)
export const editorTextSizeSchema = z.enum(['small', 'medium', 'large']).catch('small')
export type EditorTextSize = z.infer<typeof editorTextSizeSchema>
export const editorFullWidthSchema = z.boolean().catch(false)
export const dailyNotesViewSchema = z.enum(['stream', 'pages']).catch('stream')
export type DailyNotesView = z.infer<typeof dailyNotesViewSchema>

export interface SidebarWidthRange {
  readonly min: number
  readonly max: number
  readonly fallback: number
}

export const SIDEBAR_WIDTH_RANGE: SidebarWidthRange = { min: 200, max: 480, fallback: 260 }
export const CONTEXT_SIDEBAR_WIDTH_RANGE: SidebarWidthRange = {
  min: 240,
  max: 480,
  fallback: 320,
}

export function clampSidebarWidth(range: SidebarWidthRange, width: number): number {
  return Math.min(range.max, Math.max(range.min, Math.round(width)))
}

function sidebarWidthValueSchema(range: SidebarWidthRange) {
  return z
    .number()
    .catch(range.fallback)
    .transform((width) => clampSidebarWidth(range, width))
}

export const sidebarWidthSchema = sidebarWidthValueSchema(SIDEBAR_WIDTH_RANGE)
export const contextSidebarWidthSchema = sidebarWidthValueSchema(CONTEXT_SIDEBAR_WIDTH_RANGE)

export const themePreferenceSchema = z.enum(['system', 'light', 'dark']).catch('system')
export type ThemePreference = z.infer<typeof themePreferenceSchema>
export const languagePreferenceSchema = z.enum(['system', 'en', 'ru']).catch('system')
export type LanguagePreference = z.infer<typeof languagePreferenceSchema>
export const timeFormatSchema = z.enum(['12h', '24h']).catch('12h')
export type TimeFormat = z.infer<typeof timeFormatSchema>
export const dateFormatSchema = z.enum(['mdy', 'dmy', 'iso']).catch('mdy')
export type DateFormat = z.infer<typeof dateFormatSchema>
export const weekStartDaySchema = z.enum(['monday', 'sunday', 'saturday']).catch('monday')
export type WeekStartDay = z.infer<typeof weekStartDaySchema>
const WEEK_START_DOW: Record<WeekStartDay, 0 | 1 | 6> = { sunday: 0, monday: 1, saturday: 6 }
export function weekStartDow(weekStartDay: WeekStartDay): 0 | 1 | 6 {
  return WEEK_START_DOW[weekStartDay]
}

export const allNotesFilterTagsSchema = z.array(z.string()).catch(['book', 'link', 'person'])
export type AllNotesFilterTags = z.infer<typeof allNotesFilterTagsSchema>

export const graphColorSchema = z.enum([
  'indigo',
  'blue',
  'teal',
  'green',
  'amber',
  'orange',
  'red',
  'pink',
  'purple',
])
export type GraphColor = z.infer<typeof graphColorSchema>
export const GRAPH_COLOR_IDS = graphColorSchema.options
export type GraphColors = Record<string, GraphColor>
export const graphColorsSchema = z.record(z.string(), graphColorSchema).catch({})

/** Only settings used by the local Markdown application are persisted. */
export const settingsSchema = z
  .looseObject({
    editorSpellCheck: z.unknown().optional(),
    editorMarkdownSyntax: editorMarkdownSyntaxSchema,
    editorDefaultBullet: editorDefaultBulletSchema,
    editorBulletAfterHeading: editorBulletAfterHeadingSchema,
    editorSmoothCaretAnimation: editorSmoothCaretAnimationSchema,
    editorTextSize: editorTextSizeSchema,
    editorFullWidth: editorFullWidthSchema,
    dailyNotesView: dailyNotesViewSchema,
    sidebarWidth: sidebarWidthSchema,
    contextSidebarWidth: contextSidebarWidthSchema,
    theme: themePreferenceSchema,
    language: languagePreferenceSchema,
    timeFormat: timeFormatSchema,
    dateFormat: dateFormatSchema,
    weekStartDay: weekStartDaySchema,
    allNotesFilterTags: allNotesFilterTagsSchema,
    graphColors: graphColorsSchema,
  })
  .transform(({ editorSpellCheck: _legacySpellCheck, ...settings }) => settings)

export type Settings = z.infer<typeof settingsSchema>
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({})
