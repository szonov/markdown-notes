import type { ReactElement } from 'react'
import { SettingsGroup, SettingsSelectRow } from '@/mobile/settings-list.tsx'
import { MobileScreenHeader } from '@/mobile/screen-header.tsx'
import { useGraph } from '@/providers/graph-provider.tsx'
import { useRouter } from '@/routing/router.tsx'

/** The mobile build uses one app-local Markdown folder. */
export function MobileGraphs(): ReactElement {
  const { back, canBack, navigate } = useRouter()
  const { graph } = useGraph()
  return (
    <div
      className="flex h-full w-screen flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <MobileScreenHeader
        title="Notes folder"
        onBack={() => (canBack ? back() : navigate({ kind: 'settings' }))}
      />
      <main
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="px-4 py-4">
          <SettingsGroup footer="Notes stay as Markdown files on this device.">
            <SettingsSelectRow
              label={graph?.name ?? 'Local notes'}
              selected
              pending={false}
              disabled
              onPress={() => {}}
            />
          </SettingsGroup>
        </div>
      </main>
    </div>
  )
}
