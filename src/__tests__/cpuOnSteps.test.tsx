import { act, renderHook } from '@testing-library/react-native'

import { GOAL_SERVE_PAUSE_MS } from '@/games/airhockey/constants/game'
import { useAIOpponent as useAirHockeyCpu } from '@/games/airhockey/hooks/useAIOpponent'
import { useGameState as useAirHockey } from '@/games/airhockey/hooks/useGameState'
import { computeBoardLayout as airHockeyBoard } from '@/games/airhockey/utils/board'
import { SERVE_PAUSE_MS } from '@/shared/paddleGame/constants/game'
import { useAIOpponent as usePaddlesCpu } from '@/shared/paddleGame/hooks/useAIOpponent'
import { useGameState as usePaddles } from '@/shared/paddleGame/hooks/useGameState'
import { computeBoardLayout as paddlesBoard } from '@/shared/paddleGame/utils/board'

// The CPU players in Air Hockey, Paddles and Breaker decide after every physics tick, from the live
// state (useMotionReducer's onStep): a tick that only moves the puck and paddles doesn't render any
// more, and they used to decide on every render. Here each plays against nobody for a while: the CPU's
// paddle has to have gone after the puck, with the screen barely rendering.

const insets = { top: 0, bottom: 0, left: 0, right: 0 }

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

async function advance(ms: number) {
  for (let t = 0; t < ms; t += 16) {
    await act(async () => {
      jest.advanceTimersByTime(16)
    })
  }
}

// How far `paddle` travels over `ms` of play, step by step, and how many times the screen renders.
async function watch<S>(result: { current: { onStep: (listener: (state: S) => void) => () => void } }, paddle: (state: S) => { x: number; y: number }, ms: number, renders: () => number) {
  let travel = 0
  let last: { x: number; y: number } | null = null
  let stop = () => {}
  await act(async () => {
    stop = result.current.onStep((s) => {
      const p = paddle(s)
      if (last) travel += Math.hypot(p.x - last.x, p.y - last.y)
      last = p
    })
  })
  const before = renders()
  await advance(ms)
  stop()
  return { travel, renders: renders() - before }
}

it('Air Hockey’s CPU goes after the puck on every tick', async () => {
  const board = airHockeyBoard(400, 900, insets, 'vertical', 'medium', 'medium', false)
  let renders = 0
  const { result } = await renderHook(() => {
    renders++
    const game = useAirHockey(board, 7, 0.986, false)
    useAirHockeyCpu(game.state, board, 2, 'hard', false, game.setPaddleTarget, game.onStep)
    return game
  })
  await advance(GOAL_SERVE_PAUSE_MS + 50)
  expect(result.current.state.phase).toBe('live')
  const { travel } = await watch(
    result,
    (s) => s.paddles[2],
    300,
    () => renders
  )
  // Nobody in seat 1, so only the CPU can have struck the puck.
  expect(travel).toBeGreaterThan(board.paddleRadius)
  expect(result.current.live().puckInPlay).toBe(true)
})

it('the paddle games’ CPU follows the ball on every tick, and a tick that only moves things doesn’t render', async () => {
  const board = paddlesBoard(900, 400, insets, 'medium', false)
  let renders = 0
  const { result } = await renderHook(() => {
    renders++
    const game = usePaddles(board, 7, 'medium', 'vsCpu', false, false)
    usePaddlesCpu(game.state, board, 2, 'hard', false, game.setPaddleTarget, game.onStep)
    return game
  })
  await advance(SERVE_PAUSE_MS + 50)
  expect(result.current.state.phase).toBe('live')
  let steps = 0
  await act(async () => {
    result.current.onStep(() => steps++)
  })
  const watched = await watch(
    result,
    (s) => s.paddles[2],
    200,
    () => renders
  )
  expect(watched.travel).toBeGreaterThan(1)
  // Dozens of ticks, and only a render for a bounce now and then.
  expect(steps).toBeGreaterThan(20)
  expect(watched.renders).toBeLessThan(steps / 4)
})
