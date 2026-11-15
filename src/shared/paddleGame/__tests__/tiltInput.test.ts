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

  // What both platforms report for a hold, from the up vector in the device's frame (Android's
  // getOrientation and iOS's CMAttitude alike): beta = asin(up.y), gamma = atan2(-up.x, up.z). The hold
  // is given by how far the right edge dips (`dip`), how far the top edge is raised (`raise`), and
  // whether the screen faces up (true) or has tipped past vertical (false). The two edges are square to
  // each other, so a hold where both are steep doesn't exist.
  function reported(dipDeg: number, raiseDeg: number, screenUp = true): { beta: number; gamma: number } {
    const x = -Math.sin(deg(dipDeg))
    const y = Math.sin(deg(raiseDeg))
    if (x * x + y * y > 1) throw new Error(`no hold dips ${dipDeg} and raises ${raiseDeg}`)
    const z = (screenUp ? 1 : -1) * Math.sqrt(1 - x * x - y * y)
    return { beta: Math.asin(y), gamma: Math.atan2(-x, z) }
  }

  // Jay's Android, 2026-11-15: "the paddle goes to one side and then doesn't move at all anymore".
  // gamma is an Euler roll, so a phone held upright to play (up.z near 0) swings it by tens of degrees
  // on a tremor, and once the phone tips past vertical it jumps by 180.
  it.each([0, 45, 70, 80, 82])('a phone raised %d degrees steers by how far its right edge dips', (raise) => {
    const level = reported(0, raise)
    const baseline = calibrateTiltBaseline(level.beta, level.gamma, boardCenterY, PORTRAIT)
    const dipped = reported(TILT_DEAD_ZONE_DEG + 5, raise)
    const y = computeTiltTargetY(dipped.beta, dipped.gamma, baseline, -90, paddleMinY, paddleMaxY)
    expect(y - boardCenterY).toBeCloseTo((5 / (TILT_MAX_DEG - TILT_DEAD_ZONE_DEG)) * travelRadius, 5)
    const otherWay = reported(-(TILT_DEAD_ZONE_DEG + 5), raise)
    expect(computeTiltTargetY(otherWay.beta, otherWay.gamma, baseline, -90, paddleMinY, paddleMaxY) - boardCenterY).toBeCloseTo(-(y - boardCenterY), 5)
  })

  it('a calibration caught just past vertical leaves the paddle where it is once the phone is lowered, and it still steers both ways', () => {
    const pastVertical = reported(0.5, 88, false)
    const baseline = calibrateTiltBaseline(pastVertical.beta, pastVertical.gamma, boardCenterY, PORTRAIT)
    const lowered = reported(0, 60)
    expect(computeTiltTargetY(lowered.beta, lowered.gamma, baseline, -90, paddleMinY, paddleMaxY)).toBeCloseTo(boardCenterY, 5)
    const right = reported(TILT_MAX_DEG, 60)
    const left = reported(-TILT_MAX_DEG, 60)
    expect(computeTiltTargetY(right.beta, right.gamma, baseline, -90, paddleMinY, paddleMaxY)).toBeGreaterThan(boardCenterY + travelRadius * 0.9)
    expect(computeTiltTargetY(left.beta, left.gamma, baseline, -90, paddleMinY, paddleMaxY)).toBeLessThan(boardCenterY - travelRadius * 0.9)
  })

  it('tipping the phone back and forth through vertical, held level, never moves the paddle', () => {
    const start = reported(0, 75)
    const baseline = calibrateTiltBaseline(start.beta, start.gamma, boardCenterY, PORTRAIT)
    for (const [raise, screenUp] of [
      [85, true],
      [89.5, true],
      [89.5, false],
      [80, false],
      [70, true]
    ] as const) {
      const now = reported(0.2, raise, screenUp)
      expect(computeTiltTargetY(now.beta, now.gamma, baseline, -90, paddleMinY, paddleMaxY)).toBeCloseTo(boardCenterY, 5)
    }
  })

  it('scales linearly with the travel range', () => {
    const baseline = calibrateTiltBaseline(0, 0, boardCenterY, PORTRAIT)
    const halfway = computeTiltTargetY(deg(TILT_DEAD_ZONE_DEG + (TILT_MAX_DEG - TILT_DEAD_ZONE_DEG) / 2), 0, baseline, 0, paddleMinY, paddleMaxY)
    expect(halfway - boardCenterY).toBeCloseTo(travelRadius / 2, 5)
  })
})
