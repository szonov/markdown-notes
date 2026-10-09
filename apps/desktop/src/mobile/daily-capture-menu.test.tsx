import { render } from 'vitest-browser-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DailyCaptureMenu } from './daily-capture-menu.tsx'

const navigate = vi.hoisted(() => vi.fn())
const hapticImpactLight = vi.hoisted(() => vi.fn())

vi.mock('@/routing/router.tsx', () => ({ useRouter: () => ({ navigate }) }))
vi.mock('@/mobile/haptics.ts', () => ({ hapticImpactLight }))

beforeEach(() => vi.clearAllMocks())

describe('DailyCaptureMenu', () => {
  it('creates a local untitled note', async () => {
    const view = await render(<DailyCaptureMenu />)
    await view.getByRole('button', { name: 'New note' }).click()

    expect(hapticImpactLight).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'note', path: expect.stringMatching(/^notes\/.+\.md$/) }),
    )
  })
})
