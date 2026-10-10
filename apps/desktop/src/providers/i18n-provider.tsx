import { createContext, use, useEffect, useMemo, type ReactElement, type ReactNode } from 'react'
import { RU_TRANSLATIONS } from '@/i18n/ru.ts'
import { useSettings } from '@/providers/settings-provider.tsx'
import { setDateDisplayLanguage } from '@/lib/dates.ts'

export type AppLanguage = 'en' | 'ru'
export type Translate = (text: string) => string

interface I18nContextValue {
  language: AppLanguage
  t: Translate
}

const ENGLISH_I18N: I18nContextValue = { language: 'en', t: (text) => text }
const I18nContext = createContext<I18nContextValue>(ENGLISH_I18N)

function systemLanguage(): AppLanguage {
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }): ReactElement {
  const { settings } = useSettings()
  const preference = settings.language ?? 'system'
  const language: AppLanguage = preference === 'system' ? systemLanguage() : preference
  setDateDisplayLanguage(language)
  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      t:
        language === 'ru'
          ? (text) => {
              const graphSwitch = /^Switch to graph (\d+)$/.exec(text)
              if (graphSwitch?.[1] !== undefined) {
                return `Переключиться на папку ${graphSwitch[1]}`
              }
              const naming = /^Naming "(.+)"$/.exec(text)
              if (naming?.[1] !== undefined) {
                return `Присвоение имени «${naming[1]}»`
              }
              const renaming = /^Renaming "(.+)" → "(.+)"$/.exec(text)
              if (renaming?.[1] !== undefined && renaming[2] !== undefined) {
                return `Переименование «${renaming[1]}» → «${renaming[2]}»`
              }
              const unavailableOpen =
                /^Couldn’t open “(.+)” because a matching note is currently unavailable\. Try again when it is available on this device\.$/.exec(
                  text,
                )
              if (unavailableOpen?.[1] !== undefined) {
                return `Не удалось открыть «${unavailableOpen[1]}»: подходящая заметка сейчас недоступна. Повторите попытку, когда она станет доступна на этом устройстве.`
              }
              const unavailableCreate =
                /^Couldn’t create “(.+)” while a potentially matching note is unavailable\. Try again when it is available on this device\.$/.exec(
                  text,
                )
              if (unavailableCreate?.[1] !== undefined) {
                return `Не удалось создать «${unavailableCreate[1]}», пока возможно совпадающая заметка недоступна. Повторите попытку, когда она станет доступна на этом устройстве.`
              }
              const ambiguousNote =
                /^Couldn’t safely choose one note matching “(.+)”\. Rename conflicting notes or wait for unavailable notes to become available, then try again\.$/.exec(
                  text,
                )
              if (ambiguousNote?.[1] !== undefined) {
                return `Не удалось однозначно выбрать заметку «${ambiguousNote[1]}». Переименуйте конфликтующие заметки или дождитесь, когда недоступные заметки появятся, и повторите попытку.`
              }
              const unrecognizedLink = /^Unrecognized link: (.+)$/.exec(text)
              if (unrecognizedLink?.[1] !== undefined) {
                return `Нераспознанная ссылка: ${unrecognizedLink[1]}`
              }
              const noteNotFound = /^Note not found: (.+)$/.exec(text)
              if (noteNotFound?.[1] !== undefined) {
                return `Заметка не найдена: ${noteNotFound[1]}`
              }
              const rebuiltWithSkipped = /^Rebuilt with (\d+) skipped note\(s\): (.+)$/.exec(text)
              if (rebuiltWithSkipped?.[1] !== undefined && rebuiltWithSkipped[2] !== undefined) {
                return `Индекс перестроен; пропущено заметок: ${rebuiltWithSkipped[1]}. ${rebuiltWithSkipped[2]}`
              }
              const largeFile =
                /^“(.+)” is (.+)\. Git keeps every version forever; GitHub rejects files over 100 MB\.$/.exec(
                  text,
                )
              if (largeFile?.[1] !== undefined && largeFile[2] !== undefined) {
                return `«${largeFile[1]}» занимает ${largeFile[2]}. Git хранит каждую версию файла; GitHub не принимает файлы больше 100 МБ.`
              }
              return RU_TRANSLATIONS[text] ?? text
            }
          : (text) => text,
    }),
    [language],
  )

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return <I18nContext value={value}>{children}</I18nContext>
}

export function useI18n(): I18nContextValue {
  return use(I18nContext)
}
