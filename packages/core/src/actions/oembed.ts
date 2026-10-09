function isYouTubeHost(host: string): boolean {
  return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')
}

const YOUTUBE_VIDEO_ID = /^[\w-]+$/

/** Returns the YouTube oEmbed endpoint for a supported video URL. */
export function oembedRequestURL(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (!isYouTubeHost(url.hostname)) return null
  const id =
    url.hostname === 'youtu.be'
      ? url.pathname.slice(1)
      : url.pathname === '/watch'
        ? (url.searchParams.get('v') ?? '')
        : (/^\/(?:shorts|live|embed)\/([^/]+)$/.exec(url.pathname)?.[1] ?? '')
  if (!YOUTUBE_VIDEO_ID.test(id)) return null
  const request = new URL('https://www.youtube.com/oembed')
  request.searchParams.set('url', value)
  request.searchParams.set('format', 'json')
  return request.href
}
