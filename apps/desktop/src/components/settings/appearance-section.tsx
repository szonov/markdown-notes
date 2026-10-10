import type { ReactElement } from 'react'
import {
  languagePreferenceSchema,
  type LanguagePreference,
  type ThemePreference,
} from '@reflect/core'
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils.ts'
import { useSettings } from '@/providers/settings-provider.tsx'
import { SettingsField } from './field.tsx'
import { SettingsOptionCard } from './option-card.tsx'
import { SettingsSection } from './section.tsx'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx'
import { useI18n } from '@/providers/i18n-provider.tsx'

interface ThemeOption {
  value: ThemePreference
  label: string
  icon: LucideIcon
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/**
 * Theme picker as radio cards (the original app's idiom). Edits the settings
 * document directly — the ThemeProvider applies whatever is persisted, so
 * this section needs no theme context of its own.
 */
export function AppearanceSection(): ReactElement {
  const { settings, updateSettings } = useSettings()
  const { t } = useI18n()
  const languages: Array<{ value: LanguagePreference; label: string }> = [
    { value: 'system', label: t('System') },
    { value: 'ru', label: t('Russian') },
    { value: 'en', label: t('English') },
  ]

  return (
    <SettingsSection id="appearance">
      <SettingsField legend={t('Language')} description={t('Language used by the application interface.')}>
        <div className="mt-3">
          <Select
            value={settings.language}
            items={languages}
            onValueChange={(value) =>
              updateSettings({ language: languagePreferenceSchema.parse(value) })
            }
          >
            <SelectTrigger aria-label={t('Language')} className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {languages.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </SettingsField>
      <SettingsField
        legend={t('Theme')}
        description={t('System follows your OS appearance. Saved with your settings.')}
      >
        <div className="mt-3 grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = settings.theme === value
            return (
              <SettingsOptionCard
                key={value}
                selected={selected}
                className={cn(
                  'flex-col items-center gap-1.5 px-3 py-3',
                  selected ? 'text-accent-soft-text' : 'text-text-secondary',
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={selected}
                  onChange={() => updateSettings({ theme: value })}
                  className="sr-only"
                />
                <Icon aria-hidden strokeWidth={1.75} className="size-4" />
                <span className="text-xs font-medium">{t(label)}</span>
              </SettingsOptionCard>
            )
          })}
        </div>
      </SettingsField>
    </SettingsSection>
  )
}
