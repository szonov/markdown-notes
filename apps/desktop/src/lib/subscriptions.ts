/** Tracks synchronous and asynchronous unsubscribe callbacks for one effect. */
export interface SubscriptionTracker {
  add: (subscription: Promise<() => void>) => Promise<void>
  track: (dispose: () => void) => void
  disposeAll: () => void
}

export function trackSubscriptions(): SubscriptionTracker {
  let disposed = false
  const disposers: Array<() => void> = []
  const track = (dispose: () => void): void => {
    if (disposed) dispose()
    else disposers.push(dispose)
  }
  return {
    track,
    add: (subscription) => subscription.then(track),
    disposeAll: () => {
      disposed = true
      for (const dispose of disposers) dispose()
      disposers.length = 0
    },
  }
}
