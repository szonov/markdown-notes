import { useEffect, type DependencyList, type EffectCallback } from 'react'
import { isMainWindow } from '@/lib/windows/window-role.ts'

/**
 * `useEffect` that runs only in the MAIN window — the mount point for every
 * app-wide singleton: sync/backup and iCloud controllers, the capture drain,
 * update checks, and the OS
 * deep-link intake. A secondary note window mounting a second instance would
 * double-run background work and index writes, so new background controllers
 * must come through here (or carry an explicit `isMainWindow()` gate). The
 * window-ownership rule itself is documented on
 * `lib/windows/window-role.ts`.
 *
 * `deps` are checked by `react-hooks/exhaustive-deps` via the config's
 * `additionalHooks` — treat this exactly like `useEffect`.
 */
export function useMainWindowEffect(effect: EffectCallback, deps: DependencyList): void {
  useEffect(() => {
    if (!isMainWindow()) {
      return
    }
    return effect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the wrapper forwards its caller's deps verbatim
  }, deps)
}
