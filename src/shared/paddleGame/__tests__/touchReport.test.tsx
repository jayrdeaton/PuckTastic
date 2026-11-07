import { render } from '@testing-library/react-native'

import TouchInputLayer from '@/shared/paddleGame/components/TouchInputLayer'

// The touch layer reports each player's finger going down and coming up in their zone, which the play
// screen holds the serve on (Jay, 2026-11-07: no serve until the players are touching the screen). A
// recording stand-in for gesture-handler's Pan keeps each gesture's callbacks to call by hand.
type Handlers = { onBegin?: () => void; onFinalize?: () => void }
const mockGestures: Handlers[] = []
jest.mock('react-native-gesture-handler', () => {
  const pan = () => {
    const handlers: Handlers = {}
    mockGestures.push(handlers)
    const gesture: Record<string, unknown> = {}
    for (const name of ['maxPointers', 'minDistance', 'hitSlop', 'enabled', 'onStart', 'onUpdate']) gesture[name] = () => gesture
    gesture.onBegin = (fn: () => void) => ((handlers.onBegin = fn), gesture)
    gesture.onFinalize = (fn: () => void) => ((handlers.onFinalize = fn), gesture)
    return gesture
  }
  return { Gesture: { Pan: pan }, GestureDetector: ({ children }: { children: unknown }) => children }
})

beforeEach(() => {
  mockGestures.length = 0
})

describe("the paddle touch layer's touch report", () => {
  it("reports a lone player's finger going down and coming up", async () => {
    const onTouchingChange = jest.fn()
    await render(<TouchInputLayer humanPlayers={[1]} enabled containerHeight={400} rotation={-90} onPaddleTargetY={jest.fn()} onTouchingChange={onTouchingChange} />)
    const gesture = mockGestures[mockGestures.length - 1]

    gesture.onBegin!()
    expect(onTouchingChange).toHaveBeenLastCalledWith(1, true)
    gesture.onFinalize!()
    expect(onTouchingChange).toHaveBeenLastCalledWith(1, false)
  })

  it('reports each of two players from their own zone', async () => {
    const onTouchingChange = jest.fn()
    await render(<TouchInputLayer humanPlayers={[1, 2]} enabled containerHeight={400} rotation={-90} onPaddleTargetY={jest.fn()} onTouchingChange={onTouchingChange} />)
    const [zoneA, zoneB] = mockGestures.slice(-2)

    zoneB.onBegin!()
    expect(onTouchingChange).toHaveBeenLastCalledWith(2, true)
    zoneA.onBegin!()
    expect(onTouchingChange).toHaveBeenLastCalledWith(1, true)
    zoneB.onFinalize!()
    expect(onTouchingChange).toHaveBeenLastCalledWith(2, false)
  })
})
