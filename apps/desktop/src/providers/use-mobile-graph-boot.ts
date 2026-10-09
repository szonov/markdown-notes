import { useCallback, useEffect, useState } from 'react'
import {
  errorMessage,
  isMobilePlatform,
  mobileStorageLocal,
  type AppPlatform,
  type MobileStorageInfo,
  type MobileStorageKind,
} from '@reflect/core'

export interface MobileGraphBootOptions {
  platform: AppPlatform
  openRecent: (root: string) => Promise<boolean>
  onParked: (error: string | null) => void
}

export interface MobileGraphBoot {
  needsOnboarding: boolean
  mobileStorageInfo: MobileStorageInfo | null
  mobileStorageResolving: boolean
  mobileStorageKind: MobileStorageKind | null
  completeOnboarding: (kind: MobileStorageKind, root?: string) => Promise<void>
}

/** Opens the app-local Markdown directory on mobile. Cloud storage is not part of Reflect Local. */
export function useMobileGraphBoot({
  platform,
  openRecent,
  onParked,
}: MobileGraphBootOptions): MobileGraphBoot {
  const [root, setRoot] = useState<string | null>(null)

  const openLocal = useCallback(async (): Promise<void> => {
    const localRoot = await mobileStorageLocal()
    setRoot(localRoot)
    if (!(await openRecent(localRoot))) onParked('Could not open the local notes folder.')
  }, [onParked, openRecent])

  useEffect(() => {
    if (!isMobilePlatform(platform)) return
    queueMicrotask(() => {
      void openLocal().catch((error: unknown) => onParked(errorMessage(error)))
    })
  }, [openLocal, onParked, platform])

  return {
    needsOnboarding: false,
    mobileStorageInfo:
      root === null ? null : { localRoot: root, icloudDocumentsRoot: null, icloudGraphRoots: [] },
    mobileStorageResolving: false,
    mobileStorageKind: isMobilePlatform(platform) && root !== null ? 'local' : null,
    completeOnboarding: async () => await openLocal(),
  }
}
