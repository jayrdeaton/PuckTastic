import { act, renderHook } from '@testing-library/react-native'

import { MOTION_MAX_LAG_MS } from '@/shared/motion/motion'
import { changedBesides, useMotionReducer } from '@/shared/motion/useMotionReducer'

// useMotionReducer (src/shared/motion): what a step renders, and when. Box Hockey, Air Hockey, Paddles
// and Breaker each run their reducer through it; here a toy one stands in: a puck at `x` that moves
// a pixel a step, and a score.
interface Toy {
  x: number
  score: number
}
type ToyAction = { type: 'move' } | { type: 'goal' } | { type: 'place'; x: number } | { type: 'rename' }

function reducer(state: Toy, action: ToyAction): Toy {
  switch (action.type) {
    case 'move':
      return { ...state, x: state.x + 1 }
    case 'goal':
      return { x: state.x + 1, score: state.score + 1 }
    case 'place':
      return { ...state, x: action.x }
    default:
      return state
  }
}

async function renderToy() {
  let renders = 0
  const hook = await renderHook(() => {
    renders++
    return useMotionReducer(reducer, () => ({ x: 0, score: 0 }), { positions: (s: Toy) => [s.x, 0], renders: (prev: Toy, next: Toy) => changedBesides(prev, next, ['x']) })
  })
  return { ...hook, renders: () => renders }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('useMotionReducer', () => {
  it('doesn’t render a step that only moves the pieces, though the live state has it', async () => {
    const { result, renders } = await renderToy()
    const before = renders()
    await act(async () => {
      for (let i = 0; i < 30; i++) result.current.step({ type: 'move' }, 1)
    })
    expect(renders()).toBe(before)
    expect(result.current.state.x).toBe(0)
    expect(result.current.live().x).toBe(30)
  })

  it('renders a change once the drawing gets to it, a lag of play later, with everything since', async () => {
    const { result } = await renderToy()
    await act(async () => result.current.step({ type: 'goal' }, 1))
    // Drawn MOTION_LAG_MS (24ms) behind its steps: not yet, nor one 16.7ms step on.
    expect(result.current.state.score).toBe(0)
    await act(async () => result.current.step({ type: 'move' }, 1))
    expect(result.current.state.score).toBe(0)
    await act(async () => result.current.step({ type: 'move' }, 1))
    expect(result.current.state).toEqual({ x: 3, score: 1 })
  })

  it('renders a change anyway if play stops stepping before the drawing gets to it (a pause)', async () => {
    const { result } = await renderToy()
    await act(async () => result.current.step({ type: 'goal' }, 1))
    await act(async () => jest.advanceTimersByTime(MOTION_MAX_LAG_MS + 100))
    expect(result.current.state.score).toBe(1)
  })

  it('renders any other action at once, with every step before it', async () => {
    const { result } = await renderToy()
    await act(async () => {
      result.current.step({ type: 'move' }, 1)
      result.current.step({ type: 'move' }, 1)
      result.current.dispatch({ type: 'place', x: 100 })
    })
    expect(result.current.state.x).toBe(100)
  })

  it('doesn’t render an action that changes nothing', async () => {
    const { result, renders } = await renderToy()
    const before = renders()
    await act(async () => result.current.dispatch({ type: 'rename' }))
    expect(renders()).toBe(before)
  })

  it('hands every step’s live state to its listeners (a CPU player), until they stop listening', async () => {
    const { result } = await renderToy()
    const seen: number[] = []
    let stop = () => {}
    await act(async () => {
      stop = result.current.onStep((s) => seen.push(s.x))
      result.current.step({ type: 'move' }, 1)
      result.current.step({ type: 'move' }, 1)
      stop()
      result.current.step({ type: 'move' }, 1)
    })
    expect(seen).toEqual([1, 2])
  })
})
