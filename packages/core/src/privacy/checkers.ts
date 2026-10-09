import { parseFrontmatter, splitFrontmatter } from '../markdown/frontmatter.ts'

declare const cloudSafeBrand: unique symbol
export type CloudSafe<T> = T & { readonly [cloudSafeBrand]: true }

export interface CloudSendable {
  path: string
  isPrivate: boolean
}

export class PrivateNoteError extends Error {
  constructor(path: string) {
    super(`"${path}" is marked private and cannot be sent to an external service`)
    this.name = 'PrivateNoteError'
  }
}

export function assertCloudAllowed(note: CloudSendable): void {
  if (note.isPrivate) throw new PrivateNoteError(note.path)
}

/** Privacy gate for the editor's local link-preview fetch. */
export function cloudSafeLinkHref(note: CloudSendable, href: string): CloudSafe<string> {
  assertCloudAllowed(note)
  return href as CloudSafe<string>
}

export function notePrivate(source: string): boolean {
  return parseFrontmatter(splitFrontmatter(source).raw).data.private
}
