import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CloudUpload,
  Command,
  PanelLeft,
  Pin,
  RefreshCw,
  Search,
  Settings,
  Shuffle,
  SquarePen,
  SunMoon,
  type LucideIcon,
} from 'lucide-react'

/**
 * Palette row icons by command id — a UI-side map, not part of the command
 * contract: the registry stays host-agnostic (CLI and deep links don't render
 * icons), and an unmapped command just gets the generic glyph.
 */
export const COMMAND_ICONS: Record<string, LucideIcon> = {
  'nav.today': CalendarDays,
  'note.new': SquarePen,
  'history.back': ArrowLeft,
  'history.forward': ArrowRight,
  'palette.open': Search,
  'note.togglePin': Pin,
  'note.publishGist': CloudUpload,
  'note.random': Shuffle,
  'theme.toggle': SunMoon,
  'sidebar.toggle': PanelLeft,
  'settings.open': Settings,
  'index.rebuild': RefreshCw,
}

export const FALLBACK_COMMAND_ICON: LucideIcon = Command
