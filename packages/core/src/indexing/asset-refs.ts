/**
 * Does an indexed reference name this file? A bare `![[photo.png]]` is stored
 * as authored because the index cannot know its folder, so it matches any
 * attachment with that filename.
 */
export function assetReferenceMatches(reference: string, assetPath: string): boolean {
  return reference.includes('/')
    ? reference === assetPath
    : reference === (assetPath.split('/').at(-1) ?? assetPath)
}
