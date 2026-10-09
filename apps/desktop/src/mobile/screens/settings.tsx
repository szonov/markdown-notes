import type { ReactElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listNotes, type EditorTextSize, type ThemePreference } from '@reflect/core'
import { useAppVersion } from '@/hooks/use-app-version.ts'
import { useBridgeReady } from '@/hooks/use-bridge-ready.ts'
import { marketingVersion } from '@/lib/marketing-version.ts'
import { queryKeys } from '@/lib/query-client.ts'
import { MobileScreenHeader } from '@/mobile/screen-header.tsx'
import {
  SettingsGroup,
  SettingsNavRow,
  SettingsSegmentedRow,
  SettingsSwitchRow,
  SettingsValueRow,
  type SegmentedOption,
} from '@/mobile/settings-list.tsx'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useSettings } from '@/providers/settings-provider.tsx'
import { useRouter } from '@/routing/router.tsx'

const THEME_OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const TEXT_SIZE_OPTIONS: readonly SegmentedOption<EditorTextSize>[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

/** Mobile settings shared by a future Android shell: local notes only. */
export function MobileSettings(): ReactElement {
  const { back, canBack, navigate } = useRouter()
  const { graph } = useGraph()
  const { settings, updateSettings } = useSettings()
  const version = useAppVersion()
  const bridgeReady = useBridgeReady()
  const { data: notes } = useQuery({
    queryKey: queryKeys.index.mobileNoteCount(graph?.root),
    queryFn: () => listNotes(),
    enabled: bridgeReady && graph !== null,
  })

  return (
    <div
      className="flex h-full w-screen flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <MobileScreenHeader
        title="Settings"
        onBack={() => (canBack ? back() : navigate({ kind: 'today' }))}
      />
      <main
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex flex-col gap-6 px-4 py-4">
          <SettingsGroup header="Notes">
            <SettingsNavRow
              label={graph?.name ?? 'Local notes'}
              value="This device"
              onPress={() => navigate({ kind: 'graphs' })}
            />
          </SettingsGroup>
          <SettingsGroup header="Appearance">
            <SettingsSegmentedRow
              label="Theme"
              value={settings.theme}
              options={THEME_OPTIONS}
              onChange={(theme) => updateSettings({ theme })}
            />
            <SettingsSegmentedRow
              label="Text size"
              value={settings.editorTextSize}
              options={TEXT_SIZE_OPTIONS}
              onChange={(editorTextSize) => updateSettings({ editorTextSize })}
            />
          </SettingsGroup>
          <SettingsGroup header="Editor">
            <SettingsSwitchRow
              label="Smooth caret animation"
              checked={settings.editorSmoothCaretAnimation}
              onCheckedChange={(editorSmoothCaretAnimation) =>
                updateSettings({ editorSmoothCaretAnimation })
              }
            />
            <SettingsSwitchRow
              label="Start with a bullet"
              checked={settings.editorDefaultBullet}
              onCheckedChange={(editorDefaultBullet) => updateSettings({ editorDefaultBullet })}
            />
            <SettingsSwitchRow
              label="Bullet after a heading"
              checked={settings.editorBulletAfterHeading}
              onCheckedChange={(editorBulletAfterHeading) =>
                updateSettings({ editorBulletAfterHeading })
              }
            />
          </SettingsGroup>
          <SettingsGroup header="About">
            <SettingsValueRow
              label="Notes"
              value={notes === undefined ? '…' : String(notes.length)}
            />
            <SettingsValueRow
              label="Version"
              value={version === null ? '…' : marketingVersion(version)}
            />
          </SettingsGroup>
        </div>
      </main>
    </div>
  )
}
