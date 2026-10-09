import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { useEditorAutocomplete } from './use-editor-autocomplete.ts'

const resolveOrCreateNoteWithTitle = vi.hoisted(() => vi.fn())
const suggestWikiLinkTargets = vi.hoisted(() => vi.fn())
const operationFail = vi.hoisted(() => vi.fn())
const startOperation = vi.hoisted(() => vi.fn(() => ({ fail: operationFail })))

vi.mock('@reflect/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@reflect/core')>()),
  hasBridge: () => true,
  suggestWikiTargets: async () => [],
  suggestWikiLinkTargets,
  suggestTags: async () => [],
  resolveOrCreateNoteWithTitle,
}))
vi.mock('@/providers/graph-provider.tsx', () => ({
  useGraph: () => ({ graph: { generation: 7 } }),
}))
vi.mock('@/providers/settings-provider.tsx', () => ({
  useSettings: () => ({
    settings: {
      dateFormat: 'MMM d, yyyy',
      weekStartDay: 1,
    },
  }),
}))
beforeEach(() => {
  resolveOrCreateNoteWithTitle.mockReset()
  suggestWikiLinkTargets.mockReset()
  suggestWikiLinkTargets.mockResolvedValue({
    suggestions: [],
    claimedTargetKeys: [],
    queryReadsAsDate: false,
  })
  operationFail.mockReset()
  startOperation.mockClear()
})

describe('useEditorAutocomplete', () => {
  it('does not offer create when the exact query has an unaddressable claim', async () => {
    suggestWikiLinkTargets.mockResolvedValue({
      suggestions: [],
      claimedTargetKeys: ['roadmap'],
      queryReadsAsDate: false,
    })
    const { result } = await renderHook(() => useEditorAutocomplete())

    await expect(result.current.onWikilinkSearch('Roadmap')).resolves.toEqual([])
  })

  it('creates in the background without user-facing feedback on the happy path', async () => {
    resolveOrCreateNoteWithTitle.mockResolvedValue({
      kind: 'created',
      path: 'notes/business-ideas.md',
    })
    const { result, act } = await renderHook(() => useEditorAutocomplete())
    const items = await result.current.onWikilinkSearch('Business ideas')

    await act(() => {
      items[0]!.onSelect?.()
    })

    await vi.waitFor(() =>
      expect(resolveOrCreateNoteWithTitle).toHaveBeenCalledWith('Business ideas', 7),
    )
    expect(startOperation).not.toHaveBeenCalled()
    expect(operationFail).not.toHaveBeenCalled()
  })

  it('labels a `//` note by its first segment and details only an informative alias', async () => {
    suggestWikiLinkTargets.mockResolvedValue({
      suggestions: [
        {
          target: 'Tim MacCaw // Dad',
          path: 'notes/tim-maccaw-dad.md',
          title: 'Tim MacCaw // Dad',
          alias: 'Dad',
          date: null,
          insertText: 'Tim MacCaw // Dad|Dad',
        },
        {
          target: 'Charlotte MacCaw // Mum',
          path: 'notes/charlotte-maccaw-mum.md',
          title: 'Charlotte MacCaw // Mum',
          alias: 'Charlotte MacCaw',
          date: null,
          insertText: 'Charlotte MacCaw // Mum|Charlotte MacCaw',
        },
      ],
      claimedTargetKeys: [],
      queryReadsAsDate: false,
    })
    const { result } = await renderHook(() => useEditorAutocomplete())

    const items = await result.current.onWikilinkSearch('maccaw')
    expect(items.slice(0, 2)).toMatchObject([
      { target: 'Tim MacCaw // Dad|Dad', label: 'Tim MacCaw', detail: 'Dad → Tim MacCaw' },
      { target: 'Charlotte MacCaw // Mum|Charlotte MacCaw', label: 'Charlotte MacCaw' },
    ])
    expect(items[1]).not.toHaveProperty('detail')
  })

  it('details notes that share a title with their paths', async () => {
    suggestWikiLinkTargets.mockResolvedValue({
      suggestions: [
        {
          target: 'Event loop',
          path: 'notes/event-loop.md',
          title: 'Event loop',
          alias: null,
          date: null,
          insertText: 'notes/event-loop',
        },
        {
          target: 'Event loop',
          path: 'notes/event-loop-2.md',
          title: 'Event loop',
          alias: null,
          date: null,
          insertText: 'notes/event-loop-2',
        },
        {
          target: 'Event sourcing',
          path: 'notes/event-sourcing.md',
          title: 'Event sourcing',
          alias: null,
          date: null,
          insertText: 'Event sourcing',
        },
      ],
      claimedTargetKeys: [],
      queryReadsAsDate: false,
    })
    const { result } = await renderHook(() => useEditorAutocomplete())

    const items = await result.current.onWikilinkSearch('event')
    expect(items.slice(0, 3)).toMatchObject([
      { target: 'notes/event-loop', label: 'Event loop', detail: 'notes/event-loop.md' },
      { target: 'notes/event-loop-2', label: 'Event loop', detail: 'notes/event-loop-2.md' },
      { target: 'Event sourcing', label: 'Event sourcing' },
    ])
    expect(items[2]).not.toHaveProperty('detail')
  })
})
