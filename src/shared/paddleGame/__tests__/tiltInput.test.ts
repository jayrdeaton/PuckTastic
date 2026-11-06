import { Orientation } from 'expo-screen-orientation'

import { TILT_DEAD_ZONE_DEG, TILT_MAX_DEG } from '@/shared/paddleGame/constants/game'
import { calibrateTiltBaseline, computeTiltTargetY } from '@/shared/paddleGame/utils/tiltInput'

const DEG_TO_RAD = Math.PI / 180
const PORTRAIT = Orientation.PORTRAIT_UP
const deg = (degrees: number) => degrees * DEG_TO_RAD

const paddleMinY = 0
const paddleMaxY = 200
const boardCenterY = (paddleMinY + paddleMaxY) / 2
const travelRadius = (paddleMaxY - paddleMinY) / 2

describe('calibrateTiltBaseline', () => {
  it('stores beta/gamma/paddleY and the interface orientation verbatim', () => {
    expect(calibrateTiltBaseline(0.4, -0.2, 75, PORTRAIT)).toEqual({ beta: 0.4, gamma: -0.2, paddleY: 75, orientation: PORTRAIT })
  })
})

describe('computeTiltTargetY', () => {
  it('returns the baseline paddleY unchanged when beta/gamma exactly match the baseline, even off-center', () => {
    const baseline = calibrateTiltBaseline(deg(10), deg(-5), 60, PORTRAIT)
    expect(computeTiltTargetY(deg(10), deg(-5), baseline, 0, paddleMinY, paddleMaxY)).toBeCloseTo(60, 5)
  })

  it('stays exactly at the baseline within the dead zone', () => {
    const baseline = calibrateTiltBaseline(0, 0, boardCenterY, PORTRAIT)
    expect(computeTiltTargetY(deg(TILT_DEAD_ZONE_DEG), 0, baseline, 0, paddleMinY, paddleMaxY)).toBeCloseTo(boardCenterY, 5)
    expect(computeTiltTargetY(deg(TILT_DEAD_ZONE_DEG - 0.5), 0, baseline, 0, paddleMinY, paddleMaxY)).toBeCloseTo(boardCenterY, 5)
  })

  it('moves proportionally just beyond the dead zone, not in a single jump', () => {
    const baseline = calibrateTiltBaseline(0, 0, boardCenterY, PORTRAIT)
    const y = computeTiltTargetY(deg(TILT_DEAD_ZONE_DEG + 1), 0, baseline, 0, paddleMinY, paddleMaxY)
    expect(y).toBeGreaterThan(boardCenterY)
    expect(y).toBeLessThan(paddleMaxY)
  })

  it('pins at paddleMaxY/paddleMinY at TILT_MAX_DEG (baseline centered) and never overshoots beyond it', () => {
    const baseline = calibrateTiltBaseline(0, 0, boardCenterY, PORTRAIT)
    expect(computeTiltTargetY(deg(TILT_MAX_DEG), 0, baseline, 0, paddleMinY, paddleMaxY)).toBeCloseTo(paddleMaxY, 5)
    expect(computeTiltTargetY(deg(TILT_MAX_DEG + 15), 0, baseline, 0, paddleMinY, paddleMaxY)).toBeCloseTo(paddleMaxY, 5)
    expect(computeTiltTargetY(deg(-TILT_MAX_DEG), 0, baseline, 0, paddleMinY, paddleMaxY)).toBeCloseTo(paddleMinY, 5)
    expect(computeTiltTargetY(deg(-(TILT_MAX_DEG + 15)), 0, baseline, 0, paddleMinY, paddleMaxY)).toBeCloseTo(paddleMinY, 5)
  })

  it('clamps to the board edge even when the baseline itself starts near it', () => {
    // baseline.paddleY (180) + a full travelRadius (100) would overshoot to 280 without the clamp.
    const baseline = calibrateTiltBaseline(0, 0, 180, PORTRAIT)
    expect(computeTiltTargetY(deg(TILT_MAX_DEG), 0, baseline, 0, paddleMinY, paddleMaxY)).toBe(paddleMaxY)
  })

  it('an unturned court in a portrait window drives Y from beta only - gamma alone produces no movement', () => {
    const baseline = calibrateTiltBaseline(0, 0, boardCenterY, PORTRAIT)
    expect(computeTiltTargetY(0, deg(TILT_MAX_DEG), baseline, 0, paddleMinY, paddleMaxY)).toBeCloseTo(boardCenterY, 5)
  })

  it('a phone (portrait, court turned -90) drives Y from gamma only, positive, as steering always did', () => {
    const baseline = calibrateTiltBaseline(0, 0, boardCenterY, PORTRAIT)
    expect(computeTiltTargetY(deg(TILT_MAX_DEG), 0, baseline, -90, paddleMinY, paddleMaxY)).toBeCloseTo(boardCenterY, 5)
    expect(computeTiltTargetY(0, deg(TILT_MAX_DEG), baseline, -90, paddleMinY, paddleMaxY)).toBeCloseTo(paddleMaxY, 5)
  })

  // Which raw axis, and which way, moves the paddle toward paddleMaxY: the interface orientation turns the tilt into screen axes, then the
  // court's turn picks screen Y (unturned, a wide window) or screen X (turned -90, a tall window).
  it.each([
    ['landscape right, unturned court', Orientation.LANDSCAPE_RIGHT, 0, 'gamma', -1],
    ['landscape left, unturned court', Orientation.LANDSCAPE_LEFT, 0, 'gamma', 1],
    ['portrait, unturned court', Orientation.PORTRAIT_UP, 0, 'beta', 1],
    ['portrait, turned court', Orientation.PORTRAIT_UP, -90, 'gamma', 1],
    ['portrait upside down, turned court', Orientation.PORTRAIT_DOWN, -90, 'gamma', -1],
    ['landscape right, turned court', Orientation.LANDSCAPE_RIGHT, -90, 'beta', 1],
    ['landscape left, turned court', Orientation.LANDSCAPE_LEFT, -90, 'beta', -1]
  ] as const)('%s: %s', (_label, orientation, courtRotation, axis, sign) => {
    const baseline = calibrateTiltBaseline(0, 0, boardCenterY, orientation)
    const tilt = deg(TILT_MAX_DEG)
    const y = axis === 'beta' ? computeTiltTargetY(tilt, 0, baseline, courtRotation, paddleMinY, paddleMaxY) : computeTiltTargetY(0, tilt, baseline, courtRotation, paddleMinY, paddleMaxY)
    expect(y).toBeCloseTo(sign > 0 ? paddleMaxY : paddleMinY, 5)
    // The other axis alone does nothing.
    const other = axis === 'beta' ? computeTiltTargetY(0, tilt, baseline, courtRotation, paddleMinY, paddleMaxY) : computeTiltTargetY(tilt, 0, baseline, courtRotation, paddleMinY, paddleMaxY)
    expect(other).toBeCloseTo(boardCenterY, 5)
  })

  it('scales linearly with the travel range', () => {
    const baseline = calibrateTiltBaseline(0, 0, boardCenterY, PORTRAIT)
    const halfway = computeTiltTargetY(deg(TILT_DEAD_ZONE_DEG + (TILT_MAX_DEG - TILT_DEAD_ZONE_DEG) / 2), 0, baseline, 0, paddleMinY, paddleMaxY)
    expect(halfway - boardCenterY).toBeCloseTo(travelRadius / 2, 5)
  })
})
