import { DESKTOP_CHIP_BAND, fitClearOfCornerChips } from '@/shared/desktopChips'
import { TABLE_WIDTH_TO_HEIGHT_RATIO, WALL_THICKNESS } from '@/shared/paddleGame/constants/game'
import { computeBoardLayout } from '@/shared/paddleGame/utils/board'

const insets = { top: 0, bottom: 0, left: 0, right: 0 }

// The back and settings chips on a desktop play screen: 8px in from the page's top corners, 40 across.
function chipRects(width: number) {
  return [
    { x: 8, y: 8, width: 40, height: 40 },
    { x: width - 48, y: 8, width: 40, height: 40 }
  ]
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

describe('fitClearOfCornerChips', () => {
  it('keeps the ratio and fits inside the window', () => {
    for (const [w, h] of [
      [1280, 800],
      [1920, 1080],
      [1024, 768],
      [2000, 700]
    ]) {
      const fit = fitClearOfCornerChips(w, h, 16 / 9)
      expect(fit.width / fit.height).toBeCloseTo(16 / 9, 5)
      expect(fit.width).toBeLessThanOrEqual(w)
      expect(fit.height).toBeLessThanOrEqual(h)
    }
  })

  it('leaves the band down both sides or across the top and bottom, counting the overhang', () => {
    for (const [w, h] of [
      [1280, 800],
      [1920, 1080],
      [1280, 720],
      [1024, 768]
    ]) {
      const fit = fitClearOfCornerChips(w, h, 16 / 9, 10)
      const sideRoom = (w - fit.width) / 2 - 10
      const endRoom = (h - fit.height) / 2 - 10
      expect(Math.max(sideRoom, endRoom)).toBeGreaterThanOrEqual(DESKTOP_CHIP_BAND - 1e-9)
    }
  })

  it('takes whichever band leaves the bigger box', () => {
    // A 16:10 window: giving up height costs less than giving up width.
    const fit = fitClearOfCornerChips(1280, 800, 16 / 9)
    expect(fit.height).toBeCloseTo(800 - 2 * DESKTOP_CHIP_BAND, 5)
    // A window much wider than 16:9 already has room at the sides, so the box keeps the full height.
    expect(fitClearOfCornerChips(2000, 700, 16 / 9).height).toBeCloseTo(700, 5)
  })
})

describe("Paddles' and Breaker's court on desktop web", () => {
  const originalPlatform = require('react-native').Platform.OS

  beforeEach(() => {
    require('react-native').Platform.OS = 'web'
  })

  afterEach(() => {
    require('react-native').Platform.OS = originalPlatform
  })

  it.each([
    [1280, 800],
    [1280, 720],
    [1920, 1080],
    [1440, 900],
    [1024, 768]
  ])('at %ix%i, the court and its walls stay clear of the corner chips', (w, h) => {
    const board = computeBoardLayout(w, h, insets, 'medium')
    expect(board.width / board.height).toBeCloseTo(TABLE_WIDTH_TO_HEIGHT_RATIO, 5)
    const drawn = { x: board.x - WALL_THICKNESS, y: board.y - WALL_THICKNESS, width: board.width + 2 * WALL_THICKNESS, height: board.height + 2 * WALL_THICKNESS }
    for (const chip of chipRects(w)) expect(overlaps(drawn, chip)).toBe(false)
  })
})
