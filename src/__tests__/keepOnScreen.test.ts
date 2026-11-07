import { keepOnScreen, ON_SCREEN_PAD } from '@/shared/keepOnScreen'

const window = { width: 1376, height: 1032 }
const insets = { bottom: 20, left: 0, right: 0, top: 24 }

describe('keepOnScreen', () => {
  it('leaves an element that already fits where it is', () => {
    expect(keepOnScreen({ x: 200, y: 300 }, 24, 24, window, insets)).toEqual({ x: 200, y: 300 })
  })

  it('pulls an element hanging off a corner back inside the safe area, clear of its edge', () => {
    // A chip centered 16pt from a court that reaches the window's left and bottom edges.
    expect(keepOnScreen({ x: 16, y: window.height - 16 }, 24, 24, window, insets)).toEqual({ x: ON_SCREEN_PAD + 24, y: window.height - insets.bottom - ON_SCREEN_PAD - 24 })
    // A label at the top right, under the status bar.
    expect(keepOnScreen({ x: window.width - 20, y: 10 }, 30, 20, window, insets)).toEqual({ x: window.width - ON_SCREEN_PAD - 30, y: insets.top + ON_SCREEN_PAD + 20 })
  })
})
