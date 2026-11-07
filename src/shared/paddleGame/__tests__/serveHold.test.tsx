import { act, renderHook } from '@testing-library/react-native'

import { SERVE_PAUSE_MS } from '@/shared/paddleGame/constants/game'
import { useGameState } from '@/shared/paddleGame/hooks/useGameState'
import { computeBoardLayout } from '@/shared/paddleGame/utils/board'

// The serve waits while it's held (Jay, 2026-11-07): on a touch screen the play screen holds it until
// every human player is touching, so the back and settings chips stay up and there's time to back
// out. Once released it goes after the usual serve beat.
const board = computeBoardLayout(900, 400, { top: 0, bottom: 0, left: 0, right: 0 }, 'medium')

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

async function serveWith(held: boolean) {
  return renderHook(({ serveHeld }: { serveHeld: boolean }) => useGameState(board, 5, 'medium', 'vsCpu', false, false, serveHeld), { initialProps: { serveHeld: held } })
}

describe('the held serve', () => {
  it('serves after the usual beat when nothing holds it', async () => {
    const { result } = await serveWith(false)
    expect(result.current.state.phase).toBe('idle')
    await act(async () => jest.advanceTimersByTime(SERVE_PAUSE_MS))
    expect(result.current.state.phase).toBe('live')
  })

  it('waits as long as it is held, then serves a beat after it is released', async () => {
    const { result, rerender } = await serveWith(true)
    await act(async () => jest.advanceTimersByTime(SERVE_PAUSE_MS * 10))
    expect(result.current.state.phase).toBe('idle')

    await act(async () => rerender({ serveHeld: false }))
    expect(result.current.state.phase).toBe('idle')
    await act(async () => jest.advanceTimersByTime(SERVE_PAUSE_MS))
    expect(result.current.state.phase).toBe('live')
  })

  it('starts the beat over when it is held again before the serve', async () => {
    const { result, rerender } = await serveWith(false)
    await act(async () => jest.advanceTimersByTime(SERVE_PAUSE_MS - 100))
    await act(async () => rerender({ serveHeld: true }))
    await act(async () => jest.advanceTimersByTime(SERVE_PAUSE_MS * 5))
    expect(result.current.state.phase).toBe('idle')
  })
})
