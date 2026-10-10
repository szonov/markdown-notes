export {
  setBridge,
  hasBridge,
  subscribeBridgeChanges,
  type IpcBridge,
  type Unlisten,
} from '../ipc/bridge.ts'
export { call, callBinary } from '../ipc/invoke.ts'
export { type PluginSubscription } from '../ipc/plugin.ts'
export { impactLight } from '../ipc/mobile-haptics-plugin.ts'
export {
  getAppVersion,
  mobileStorageLocal,
  mergeText,
  type MergeTextOutcome,
  type MobileStorageInfo,
  type MobileStorageKind,
} from '../ipc/commands.ts'
export { isMobilePlatform, type AppPlatform } from '../app/platform.ts'
export { confirmQuit, subscribeQuitRequested } from '../app/quit.ts'
export {
  beginBackgroundTask,
  endBackgroundTask,
  type BackgroundTaskToken,
} from '../app/background-task.ts'
export { WINDOW_NAVIGATE_EVENT, subscribeWindowNavigate } from '../app/window-events.ts'
export { toggleDevtools } from '../app/devtools.ts'
export {
  appErrorSchema,
  errorMessage,
  isAppError,
  toAppError,
  ReflectError,
  type AppError,
} from '../errors.ts'
export {
  DAILY_DIR,
  NOTES_DIR,
  ASSETS_DIR,
  dailyPath,
  notePath,
  assetPath,
  isDaily,
  isNotePath,
  isAttachmentPath,
  isSafeVisibleGraphPath,
  classifyGraphPath,
  mayContainNotes,
  dateFromDailyPath,
  foldGraphPath,
  isCalendarDate,
  type GraphPathKind,
} from '../graph/paths.ts'
export {
  createAttachmentCatalog,
  isImageAttachmentPath,
  resolveAttachmentLink,
  resolveWikiEmbedTarget,
  type AttachmentCatalog,
  type WikiEmbedTarget,
} from '../graph/attachment-resolution.ts'
export {
  wikiNoteReference,
  markdownNoteReference,
  noteBasenameKey,
  type NoteReference,
} from '../graph/note-reference.ts'
export {
  isValidReflectNoteId,
  isReflectManagedNotePath,
  isReflectManagedNote,
} from '../graph/note-management.ts'
export {
  graphInfoSchema,
  recentGraphSchema,
  fileMetaSchema,
  noteCreateOutcomeSchema,
  windowBootstrapSchema,
  type GraphInfo,
  type RecentGraph,
  type FileMeta,
  type NoteCreateOutcome,
  type WindowBootstrap,
} from '../graph/schemas.ts'
export {
  openGraph,
  openNoteWindow,
  windowBootstrap,
  closeNoteWindows,
  createGraph,
  readNote,
  readNoteLocal,
  type LocalNoteRead,
  writeNote,
  createNoteIfAbsent,
  writeAsset,
  readAsset,
  openAsset,
  revealAsset,
  noteExists,
  deleteNote,
  deleteNoteRevision,
  listFiles,
  listAttachments,
  vaultScanStats,
  type VaultScanStats,
  recentGraphs,
  forgetRecent,
  deleteGraph,
} from '../graph/commands.ts'
export { createAsset, importAsset } from '../graph/assets.ts'
export { assetFileName } from '../graph/asset-names.ts'
export {
  newNoteId,
  newNoteSource,
  untitledNoteSeed,
  untitledNotePath,
  isUntitledNotePath,
  createNoteWithTitle,
  resolveOrCreateNoteWithTitle,
  type ResolveOrCreateNoteResult,
} from '../graph/create-note.ts'
export {
  resolveExistingMarkdownTarget,
  resolveExistingWikiTarget,
  type ExistingWikiTargetResolution,
} from '../graph/resolve-existing-wiki-target.ts'
export {
  settingsSchema,
  editorMarkdownSyntaxSchema,
  editorDefaultBulletSchema,
  editorBulletAfterHeadingSchema,
  editorSmoothCaretAnimationSchema,
  editorTextSizeSchema,
  editorFullWidthSchema,
  dailyNotesViewSchema,
  sidebarWidthSchema,
  contextSidebarWidthSchema,
  SIDEBAR_WIDTH_RANGE,
  CONTEXT_SIDEBAR_WIDTH_RANGE,
  clampSidebarWidth,
  themePreferenceSchema,
  languagePreferenceSchema,
  timeFormatSchema,
  dateFormatSchema,
  weekStartDaySchema,
  weekStartDow,
  allNotesFilterTagsSchema,
  graphColorSchema,
  graphColorsSchema,
  GRAPH_COLOR_IDS,
  DEFAULT_SETTINGS,
  type Settings,
  type EditorMarkdownSyntax,
  type EditorTextSize,
  type DailyNotesView,
  type SidebarWidthRange,
  type ThemePreference,
  type LanguagePreference,
  type TimeFormat,
  type DateFormat,
  type WeekStartDay,
  type AllNotesFilterTags,
  type GraphColor,
  type GraphColors,
} from '../settings/schema.ts'
export { loadSettings, saveSettings } from '../settings/commands.ts'
