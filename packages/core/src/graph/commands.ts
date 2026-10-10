import { z } from 'zod'
import { echoLocalWrite } from '../indexing/local-write-echo.ts'
import { call } from '../ipc/invoke.ts'
import {
  fileMetaSchema,
  graphInfoSchema,
  noteCreateOutcomeSchema,
  recentGraphSchema,
  windowBootstrapSchema,
  type FileMeta,
  type GraphInfo,
  type NoteCreateOutcome,
  type RecentGraph,
  type WindowBootstrap,
} from './schemas.ts'

/** Commands that return `()` from Rust serialize as `null` over IPC. */
const voidSchema = z.null()

/** Open an existing graph at `path` (ensures the standard layout exists). */
export async function openGraph(path: string): Promise<GraphInfo> {
  return await call('graph_open', { path }, graphInfoSchema)
}

/**
 * Open (or focus) a secondary note window on a `reflect://` route link
 * (⌘-click a note link). Desktop-only; requires an open graph, which the new
 * window adopts — see {@link windowBootstrap}.
 */
export async function openNoteWindow(deepLink: string): Promise<void> {
  await call('open_note_window', { deepLink }, voidSchema)
}

/**
 * Adopt the already-open graph for a secondary note window: a pure read of
 * the current graph + index sessions (never `graph_open`/`index_open`, whose
 * generation bumps would strand the main window's pinned commands) plus the
 * one-shot deep link the window was created for. Errors when no graph is open.
 */
export async function windowBootstrap(): Promise<WindowBootstrap> {
  return await call('window_bootstrap', {}, windowBootstrapSchema)
}

/**
 * Close every note window and wait (bounded) for their flushes to land.
 * Call BEFORE anything that bumps the graph/index generations (switch,
 * delete): note windows adopted the outgoing session, and a bump-first
 * ordering would reject their final saves as stale.
 */
export async function closeNoteWindows(): Promise<void> {
  await call('close_note_windows', {}, voidSchema)
}

/** Create a new graph at `path` and open it. */
export async function createGraph(path: string): Promise<GraphInfo> {
  return await call('graph_create', { path }, graphInfoSchema)
}

/**
 * Read a note's markdown by graph-relative path. `generation`, when given,
 * pins the read to the issuing graph session — background passes that can
 * span a graph switch must pin every read; UI reads of the open graph omit it.
 */
export async function readNote(path: string, generation?: number): Promise<string> {
  return await call('note_read', { path, generation }, z.string())
}

const localNoteReadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('content'), content: z.string() }),
  z.object({ kind: z.literal('evicted') }),
])

/** How a {@link readNoteLocal} request found the note on disk. */
export type LocalNoteRead = z.infer<typeof localNoteReadSchema>

/**
 * Read a note's markdown **only when its bytes are local**, reporting an
 * iCloud-evicted note as `{ kind: 'evicted' }` instead of reading it. Bulk
 * background passes
 * must use this instead of {@link readNote}: reading an evicted note blocks
 * while the OS materializes it on demand, and a whole-graph pass over an
 * evicted iCloud graph becomes thousands of serial blocking downloads.
 * Missing files still reject with `notFound`, exactly like {@link readNote}.
 */
export async function readNoteLocal(path: string, generation?: number): Promise<LocalNoteRead> {
  return await call('note_read_local', { path, generation }, localNoteReadSchema)
}

/**
 * Atomically write a note's markdown by graph-relative path. `generation` (from
 * `GraphInfo`) pins the write to the graph it was issued for — Rust rejects it
 * if the graph switched in between.
 *
 * `expectedContents` rejects a stale source revision; null requires a missing
 * file, while omission keeps an unconditional write.
 *
 * The echo carries the file's on-disk mtime, which Rust returns from the
 * write: the index row it produces must compare equal to a later `listFiles`
 * mtime, or the reconcile's read-free skip never fires and the note is
 * re-read on every pass. `Date.now()` is a fallback for a platform that
 * can't report one.
 */
export async function writeNote(
  path: string,
  contents: string,
  generation: number,
  expectedContents?: string | null,
): Promise<void> {
  const modifiedMs = await call(
    'note_write',
    {
      path,
      contents,
      generation,
      ...(expectedContents === undefined ? {} : { checkContents: true, expectedContents }),
    },
    z.number().nullable(),
  )
  echoLocalWrite({ path, kind: 'upsert', modifiedMs: modifiedMs ?? Date.now() })
}

/**
 * Atomically create a note only if `path` is still unoccupied. A collision is
 * returned as data and never overwrites the winner, closing the race between a
 * caller's availability check and a concurrent sync checkout or creator.
 */
export async function createNoteIfAbsent(
  path: string,
  contents: string,
  generation: number,
): Promise<NoteCreateOutcome> {
  const outcome = await call('note_create', { path, contents, generation }, noteCreateOutcomeSchema)
  if (outcome.kind === 'created') {
    echoLocalWrite({ path, kind: 'upsert', modifiedMs: outcome.modifiedMs ?? Date.now() })
  }
  return outcome
}

/**
 * Atomically write a binary asset (pasted/dropped image) by graph-relative
 * path. `contentsBase64` is the file's bytes, base64-encoded for the JSON IPC.
 */
export async function writeAsset(
  path: string,
  contentsBase64: string,
  generation: number,
): Promise<void> {
  await call('asset_write', { path, contentsBase64, generation }, voidSchema)
  echoLocalWrite({ path, kind: 'upsert', modifiedMs: Date.now() })
}

/**
 * Read a binary asset's bytes by graph-relative path, base64-encoded (the IPC
 * is JSON). `generation` pins
 * the read: background passes can span a graph switch, and an unpinned read
 * would resolve against the new graph's same-named file.
 */
export async function readAsset(path: string, generation: number): Promise<string> {
  return await call('asset_read', { path, generation }, z.string())
}

/**
 * Open an asset by graph-relative path in the system default application.
 * `generation` pins the request to the graph whose markdown produced the
 * image, so a delayed click after a graph switch cannot open another graph's
 * same-named file.
 */
export async function openAsset(path: string, generation: number): Promise<void> {
  await call('asset_open', { path, generation }, voidSchema)
}

/**
 * Reveal a graph file in the OS file manager, the fallback when
 * {@link openAsset} refuses a file type. Pinned to `generation` for the same
 * reason.
 */
export async function revealAsset(path: string, generation: number): Promise<void> {
  await call('asset_reveal', { path, generation }, voidSchema)
}

/**
 * Does a graph-relative path currently exist as a file on disk? Probes the
 * filesystem directly — unlike an index lookup, this can't lag the watcher.
 */
export async function noteExists(path: string): Promise<boolean> {
  return await call('note_exists', { path }, z.boolean())
}

/** Send a note to the OS trash (recoverable; pinned to `generation`). */
export async function deleteNote(path: string, generation: number): Promise<void> {
  await call('note_delete', { path, generation }, voidSchema)
  echoLocalWrite({ path, kind: 'remove' })
}

/**
 * Delete a note only while its on-disk text still equals `expectedContents`.
 * Used by autosave when an existing daily note is cleared: an external edit
 * that races the empty save must win instead of being sent to the trash.
 */
export async function deleteNoteRevision(
  path: string,
  generation: number,
  expectedContents: string,
): Promise<void> {
  await call('note_delete_revision', { path, generation, expectedContents }, voidSchema)
  echoLocalWrite({ path, kind: 'remove' })
}

/**
 * List eligible Markdown notes at the graph root and in visible nested
 * folders. `generation` pins the listing like {@link readNote}'s.
 */
export async function listFiles(generation?: number): Promise<FileMeta[]> {
  return await call('list_files', { generation }, z.array(fileMetaSchema))
}

/**
 * List supported local attachments anywhere in the vault, from the same
 * cached catalog as {@link listFiles}.
 */
export async function listAttachments(generation?: number): Promise<FileMeta[]> {
  return await call('list_attachments', { generation }, z.array(fileMetaSchema))
}

const vaultScanStatsSchema = z.object({
  notes: z.number(),
  attachments: z.number(),
  skipped: z.number(),
})

export type VaultScanStats = z.infer<typeof vaultScanStatsSchema>

/**
 * Counts from the vault catalog. `skipped` is what the walk refused or failed
 * to list (unreadable directories, symlinks, default-pruned trees) — surfaced
 * so "why isn't my file showing up" stays diagnosable.
 */
export async function vaultScanStats(generation?: number): Promise<VaultScanStats> {
  return await call('vault_scan_stats', { generation }, vaultScanStatsSchema)
}

/** The recently-opened graphs, newest first. */
export async function recentGraphs(): Promise<RecentGraph[]> {
  return await call('recent_graphs', {}, z.array(recentGraphSchema))
}

/** Drop a graph from the recents list (by root path). */
export async function forgetRecent(root: string): Promise<void> {
  await call('forget_recent', { root }, voidSchema)
}

/**
 * Move the open graph's whole directory to the OS trash (recoverable) and
 * drop it from recents. Pinned to `generation` so a delete can never race a
 * graph switch and trash the newly opened graph. Desktop-only.
 */
export async function deleteGraph(generation: number): Promise<void> {
  await call('graph_delete', { generation }, voidSchema)
}
