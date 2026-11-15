import { render } from '@testing-library/react-native'
import { Orientation } from 'expo-screen-orientation'

import TiltInputLayer from '@/shared/paddleGame/components/TiltInputLayer'
import type { BoardLayout } from '@/shared/paddleGame/types'

// One DeviceMotion listener at a time, driven by hand.
type Sample = { rotation: { beta: number; gamma: number }; orientation: number }
let mockEmit: ((sample: Sample) => void) | null = null
jest.mock('expo-sensors', () => ({
  DeviceMotion: {
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((listener: (sample: Sample) => void) => {
      mockEmit = listener
      return { remove: jest.fn(() => (mockEmit = null)) }
    })
  }
}))

// The interface orientation, set by each test.
let mockOrientation: number = Orientation.PORTRAIT_UP
const mockRemoveTracker = jest.fn()
jest.mock('@tastic/core/interface-orientation', () => ({
  ...jest.requireActual('@tastic/core/interface-orientation'),
  trackInterfaceOrientation: () => ({ current: () => mockOrientation, remove: mockRemoveTracker })
}))

const board = { paddleMinY: 0, paddleMaxY: 200 } as BoardLayout
const deg = (degrees: number) => (degrees * Math.PI) / 180
const sample = (beta: number, gamma: number) => ({ rotation: { beta: deg(beta), gamma: deg(gamma) }, orientation: 0 })

beforeEach(() => {
  mockOrientation = Orientation.PORTRAIT_UP
  mockEmit = null
})

async function renderLayer(rotation: 0 | -90 = -90) {
  const onPaddleTargetY = jest.fn()
  const result = await render(<TiltInputLayer player={1} enabled phase='live' rotation={rotation} board={board} paddleY={() => 100} onPaddleTargetY={onPaddleTargetY} />)
  return { onPaddleTargetY, ...result }
}

describe('TiltInputLayer', () => {
  it('calibrates on the first sample, then steers a phone by gamma', async () => {
    const { onPaddleTargetY } = await renderLayer()
    mockEmit!(sample(0, 0))
    expect(onPaddleTargetY).not.toHaveBeenCalled()
    mockEmit!(sample(0, 40))
    expect(onPaddleTargetY).toHaveBeenLastCalledWith(1, 200)
  })

  it('recalibrates where the paddle is when the interface turns mid-round, instead of jumping', async () => {
    const { onPaddleTargetY } = await renderLayer(0)
    mockOrientation = Orientation.LANDSCAPE_RIGHT
    mockEmit!(sample(0, 0))
    mockEmit!(sample(0, -40))
    // Landscape right, unturned court: screen Y is -gamma, so a negative gamma moves the paddle down.
    expect(onPaddleTargetY).toHaveBeenLastCalledWith(1, 200)
    onPaddleTargetY.mockClear()

    mockOrientation = Orientation.LANDSCAPE_LEFT
    mockEmit!(sample(10, -40))
    // The turn's own sample only recalibrates.
    expect(onPaddleTargetY).not.toHaveBeenCalled()
    mockEmit!(sample(10, -40))
    expect(onPaddleTargetY).toHaveBeenLastCalledWith(1, 100)
  })

  it('stops following the interface when unmounted', async () => {
    const { unmount } = await renderLayer()
    mockRemoveTracker.mockClear()
    await unmount()
    expect(mockRemoveTracker).toHaveBeenCalled()
    expect(mockEmit).toBeNull()
  })
})
