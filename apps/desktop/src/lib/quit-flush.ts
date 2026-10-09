import { getCurrentWindow } from '@tauri-apps/api/window'
import { confirmQuit, subscribeQuitRequested } from '@reflect/core'
import { flushOpenDocuments } from '@/editor/open-documents.ts'
import { isMacosDesktop, isNativeShell } from '@/lib/platform.ts'
import { flushSettings } from '@/lib/settings-flush.ts'
import { trackSubscriptions } from '@/lib/subscriptions.ts'
import { isMainWindow } from '@/lib/windows/window-role.ts'

/**
 * Quit-time persistence: the webview never dies with dirty note buffers still
 * inside their save debounce — or with settings writes still in their queue.
 * Three exits, three hooks:
 *
 * - **Window close** (red button, ⌘W): registering a JS `onCloseRequested`
 *   listener defers the close until the handler returns, so the flush is
 *   awaited before the window is destroyed. On macOS the main window stays
 *   alive and is hidden after flushing, preserving normal last-window close
 *   behavior without terminating the app; secondary windows still close.
 * - **App quit** (⌘Q): never reaches close-requested — the Rust shell defers
 *   `ExitRequested` once and emits `app:quit-requested`; we flush, then
 *   `confirmQuit()` exits for real (even if a flush failed: its error is
 *   already surfaced per-note, and refusing to quit would trap the user).
 * - **Webview unload** (dev reloads): `beforeunload` can't await, but writes
 *   dispatched before teardown still reach the Rust process — a belt.
 *
 * Mobile's exit is backgrounding, not quitting — its leg of the same flush
 * sequence lives in `background-flush.ts` (Plan 19, decision 6).
 */
export function installQuitFlush(): () => void {
  // No native shell (browser dev): nothing can quit-flush. getCurrentWindow
  // below is safe to reach only inside a Tauri webview.
  if (!isNativeShell()) {
    return () => {}
  }

  // A subscription can resolve after teardown (StrictMode's probe mount) —
  // the tracker disposes it on the spot.
  const subscriptions = trackSubscriptions()
  const currentWindow = getCurrentWindow()

  void subscriptions.add(
    currentWindow.onCloseRequested(async (event) => {
      const shouldHide = isMacosDesktop && isMainWindow()
      if (shouldHide) {
        // Prevent synchronously: waiting until after the flush lets AppKit
        // destroy the last window (and Tauri then terminates the process).
        event.preventDefault()
      }
      await Promise.allSettled([flushOpenDocuments(), flushSettings()])
      if (shouldHide) {
        await currentWindow.hide()
      }
    }),
  )

  void subscriptions.add(
    subscribeQuitRequested(() => {
      void Promise.allSettled([flushOpenDocuments(), flushSettings()]).then(() => {
        void confirmQuit()
      })
    }),
  )

  const onBeforeUnload = (): void => {
    void flushOpenDocuments()
    void flushSettings()
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  subscriptions.track(() => window.removeEventListener('beforeunload', onBeforeUnload))

  return () => {
    subscriptions.disposeAll()
  }
}
