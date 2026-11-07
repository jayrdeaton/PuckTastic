import { BALL_SPEED_TIERS } from '@/shared/paddleGame/constants/game'
import type { BallSpeedLevel } from '@/shared/paddleGame/types'

// How fast a rally builds (Jay, 2026-11-07: the ramp was "WAY too fast"): each paddle hit adds the
// tier's increment, so a ball reaches its top speed only after a long rally, about a dozen hits each,
// not the 8 or 9 hits in all it took before.
describe('the speed ramp', () => {
  const hitsToTop = (level: BallSpeedLevel) => {
    const { base, increment, max } = BALL_SPEED_TIERS[level]
    return Math.ceil((max - base) / increment)
  }

  it.each<BallSpeedLevel>(['slow', 'medium', 'fast'])('takes a long rally to reach top speed on %s', (level) => {
    expect(hitsToTop(level)).toBeGreaterThanOrEqual(20)
    expect(hitsToTop(level)).toBeLessThanOrEqual(30)
  })

  it('keeps each tier faster than the one below, from the serve to the top', () => {
    expect(BALL_SPEED_TIERS.slow.base).toBeLessThan(BALL_SPEED_TIERS.medium.base)
    expect(BALL_SPEED_TIERS.medium.base).toBeLessThan(BALL_SPEED_TIERS.fast.base)
    expect(BALL_SPEED_TIERS.slow.max).toBeLessThan(BALL_SPEED_TIERS.medium.max)
    expect(BALL_SPEED_TIERS.medium.max).toBeLessThan(BALL_SPEED_TIERS.fast.max)
  })
})
