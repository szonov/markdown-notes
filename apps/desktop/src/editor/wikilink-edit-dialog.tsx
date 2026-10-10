import { Priority, type EditorExtension } from '@meowdown/core'
import { useEditor, useKeymap } from '@meowdown/react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react'
import { createPortal } from 'react-dom'

interface WikilinkDraft {
  from: number
  to: number
  target: string
  text: string
  left: number
  top: number
}

/** Parse exactly one selected wiki link, including its optional display alias. */
function parseSelectedWikilink(source: string): Pick<WikilinkDraft, 'target' | 'text'> | null {
  const match = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(source.trim())
  if (match === null) return null
  const target = match[1]?.trim() ?? ''
  const text = match[2]?.trim() || target
  return target === '' || text === '' ? null : { target, text }
}

/**
 * Gives a selected `[[target|label]]` its own editor before meowdown's generic
 * Markdown-link command sees Mod-K. The generic dialog expects `[label](href)`
 * and therefore treats the whole wiki source as label text with an empty URL.
 */
export function WikilinkEditDialog(): ReactElement | null {
  const editor = useEditor<EditorExtension>()
  const [draft, setDraft] = useState<WikilinkDraft | null>(null)

  const keymap = useMemo(
    () => ({
      'Mod-k': () => {
        const { from, to, empty } = editor.state.selection
        if (empty) return false
        const parsed = parseSelectedWikilink(editor.state.doc.textBetween(from, to, '\n'))
        if (parsed === null) return false
        const start = editor.view.coordsAtPos(from)
        const end = editor.view.coordsAtPos(to)
        const width = Math.min(320, window.innerWidth - 16)
        const center = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2
        setDraft({
          from,
          to,
          ...parsed,
          left: Math.max(8, Math.min(center - width / 2, window.innerWidth - width - 8)),
          top: Math.min(Math.max(start.bottom, end.bottom) + 8, window.innerHeight - 190),
        })
        return true
      },
    }),
    [editor],
  )
  useKeymap(keymap, { priority: Priority.highest })

  const popupRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (draft === null) return
    function dismissOnPointerDown(event: PointerEvent): void {
      if (!popupRef.current?.contains(event.target as Node)) close()
    }
    function dismissOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    document.addEventListener('pointerdown', dismissOnPointerDown, { capture: true })
    document.addEventListener('keydown', dismissOnEscape, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', dismissOnPointerDown, { capture: true })
      document.removeEventListener('keydown', dismissOnEscape, { capture: true })
    }
  }, [draft, editor])

  if (draft === null) return null

  const target = draft.target.trim()
  const text = draft.text.trim()
  const canSave = target !== '' && text !== '' && !target.includes('|') && !target.includes(']]')

  function close(): void {
    setDraft(null)
    requestAnimationFrame(() => editor.focus())
  }

  function save(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!canSave || draft === null) return
    const markdown = text === target ? `[[${target}]]` : `[[${target}|${text}]]`
    replace(markdown)
  }

  function replace(markdown: string): void {
    if (draft === null) return
    if (
      !editor.commands.startPendingReplacement({
        from: draft.from,
        to: draft.to,
        mode: 'replace',
      })
    ) {
      return
    }
    editor.commands.appendPendingReplacementText(markdown)
    editor.commands.acceptPendingReplacement()
    close()
  }

  return createPortal(
    <div
      ref={popupRef}
      role="dialog"
      aria-label="Edit internal link"
      className="fixed z-50 flex w-[min(20rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border border-[color:var(--meowdown-hover-card-border)] bg-[color:var(--meowdown-popover-bg)] text-sm text-[color:var(--meowdown-text)] shadow-md"
      style={{ left: draft.left, top: draft.top }}
      data-testid="wikilink-edit-dialog"
    >
      <form className="flex flex-col gap-2.5 p-3" onSubmit={save}>
        <label className="flex flex-col gap-1">
          <span className="text-[0.8125rem] font-medium text-[color:var(--meowdown-muted)]">
            Text
          </span>
          <input
            autoFocus
            className="h-8 w-full rounded-lg border border-[color:var(--meowdown-input-border)] bg-transparent px-2.5 font-[inherit] text-[color:var(--meowdown-text)] outline-none transition-[border-color,box-shadow] placeholder:text-[color:var(--meowdown-placeholder)] focus:border-[color:var(--meowdown-focus-ring)] focus:ring-3 focus:ring-[color-mix(in_oklab,var(--meowdown-focus-ring)_50%,transparent)]"
            value={draft.text}
            data-testid="wikilink-text-input"
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.8125rem] font-medium text-[color:var(--meowdown-muted)]">
            Link
          </span>
          <input
            className="h-8 w-full rounded-lg border border-[color:var(--meowdown-input-border)] bg-transparent px-2.5 font-[inherit] text-[color:var(--meowdown-text)] outline-none transition-[border-color,box-shadow] placeholder:text-[color:var(--meowdown-placeholder)] focus:border-[color:var(--meowdown-focus-ring)] focus:ring-3 focus:ring-[color-mix(in_oklab,var(--meowdown-focus-ring)_50%,transparent)]"
            value={draft.target}
            data-testid="wikilink-target-input"
            onChange={(event) => setDraft({ ...draft, target: event.target.value })}
          />
        </label>
        <div className="flex items-center justify-end gap-1.5 pt-0.5">
          <button
            type="button"
            className="mr-auto min-h-8 cursor-pointer rounded-lg border-0 bg-transparent px-2.5 py-1.5 font-[inherit] font-medium text-[color:var(--meowdown-danger)] hover:bg-[color-mix(in_oklab,var(--meowdown-danger)_10%,transparent)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklab,var(--meowdown-focus-ring)_50%,transparent)] focus-visible:outline-none"
            onClick={() => replace(text)}
          >
            Remove link
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="min-h-8 cursor-pointer rounded-lg border-0 bg-[color:var(--meowdown-accent)] px-2.5 py-1.5 font-[inherit] font-medium text-[color:var(--meowdown-accent-contrast)] transition-[background-color,transform] hover:not-disabled:bg-[color-mix(in_oklab,var(--meowdown-accent)_80%,transparent)] active:not-disabled:translate-y-px disabled:cursor-default disabled:opacity-50 focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklab,var(--meowdown-focus-ring)_50%,transparent)] focus-visible:outline-none"
            data-testid="wikilink-save"
          >
            Save
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
