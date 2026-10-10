import type { ReactElement } from 'react'
import type { OpenTask } from '@reflect/core'
import { MarkdownPreview } from '@/editor/markdown-preview.tsx'

/**
 * Render a task's Markdown (its first paragraph, marker excluded) through
 * Reflect's read-only markdown preview, as one paragraph. Markdown block
 * markers at the start stay task text instead of becoming a second checkbox,
 * heading, quote, or code block.
 */
export function TaskText({ task }: { task: OpenTask }): ReactElement {
  return (
    <MarkdownPreview
      content={task.markdown}
      singleParagraph
      className="reflect-task-preview pointer-events-none text-[13px] font-medium"
    />
  )
}
