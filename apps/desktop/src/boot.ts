import { tauriBridge } from '@/lib/tauri-bridge.ts'
import { setBridge } from '@reflect/core'

import { isTauri } from '@tauri-apps/api/core'

// Install the Tauri bridge when running inside a Tauri webview. Plain-browser
// dev (`pnpm dev` without the shell) installs nothing here — the platform
// root later installs the in-memory dev bridge instead, and features that
// need the real shell rather than just an answering bridge gate on
// `isNativeShell()`.
if (isTauri()) {
  setBridge(tauriBridge)
}
