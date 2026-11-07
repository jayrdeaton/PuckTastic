import { BRICK_DEPTH_RATIO, PADDLE_HEIGHT_RATIOS, SHARED_BRICK_FIELD_Y_MARGIN_RATIO, SHARED_BRICK_ROWS, SHARED_BRICKS_PER_ROW, SOLO_BRICK_FAR_GAP_ROWS, SOLO_BRICK_ROWS, SOLO_BRICKS_PER_ROW, TABLE_WIDTH_TO_HEIGHT_RATIO } from '@/shared/paddleGame/constants/game'
import { Brick, PaddleSizeLevel } from '@/shared/paddleGame/types'
import { buildSharedBrickField, buildSoloBrickField, centerBall, centerPaddle, clampPaddleY, computeBoardLayout, servingBall } from '@/shared/paddleGame/utils/board'

const insets = { top: 0, bottom: 0, left: 0, right: 0 }
const sizes: PaddleSizeLevel[] = ['small', 'medium', 'large']

function withinBoard(brick: Brick, board: ReturnType<typeof computeBoardLayout>): boolean {
  return brick.x >= board.x && brick.y >= board.y && brick.x + brick.width <= board.x + board.width && brick.y + brick.height <= board.y + board.height
}

describe('paddleHeight scales per PaddleSizeLevel tier', () => {
  it.each(sizes)('matches PADDLE_HEIGHT_RATIOS at paddleSize=%s', (size) => {
    const board = computeBoardLayout(900, 400, insets, size)
    expect(board.paddleHeight).toBeCloseTo(board.height * PADDLE_HEIGHT_RATIOS[size], 5)
  })

  it('a larger tier produces a taller paddle than a smaller one', () => {
    const small = computeBoardLayout(900, 400, insets, 'small')
    const large = computeBoardLayout(900, 400, insets, 'large')
    expect(large.paddleHeight).toBeGreaterThan(small.paddleHeight)
  })
})

describe('paddleX', () => {
  it('player 1 always sits left of player 2, both inset from their own edge', () => {
    const board = computeBoardLayout(900, 400, insets, 'medium')
    expect(board.paddleX[1]).toBeLessThan(board.paddleX[2])
    expect(board.paddleX[1]).toBeGreaterThan(board.x)
    expect(board.paddleX[2]).toBeLessThan(board.x + board.width)
  })

  it('stays proportionally symmetric around centerX regardless of paddleSize (inset is width-derived, not size-tiered)', () => {
    const board = computeBoardLayout(900, 400, insets, 'medium')
    const insetP1 = board.paddleX[1] - board.x
    const insetP2 = board.x + board.width - board.paddleX[2]
    expect(insetP1).toBeCloseTo(insetP2, 5)
  })
})

describe('ballRadius', () => {
  it('scales with board HEIGHT, not width - the axis that stays meaningful across both seating orientations', () => {
    const short = computeBoardLayout(900, 300, insets, 'medium')
    const tall = computeBoardLayout(900, 600, insets, 'medium')
    expect(tall.ballRadius).toBeGreaterThan(short.ballRadius)
  })
})

describe('paddleMinY / paddleMaxY', () => {
  it('bracket centerY, inset by paddleHeight/2, spanning the FULL board height - no half-court clamp, unlike AirHockey', () => {
    const board = computeBoardLayout(900, 400, insets, 'medium')
    expect(board.paddleMinY).toBeCloseTo(board.y + board.paddleHeight / 2, 5)
    expect(board.paddleMaxY).toBeCloseTo(board.y + board.height - board.paddleHeight / 2, 5)
    expect(board.centerY).toBeGreaterThan(board.paddleMinY)
    expect(board.centerY).toBeLessThan(board.paddleMaxY)
    expect(board.paddleMaxY - board.paddleMinY).toBeCloseTo(board.height - board.paddleHeight, 5)
  })
})

describe('desktop web letterboxing', () => {
  const originalPlatform = require('react-native').Platform.OS

  afterEach(() => {
    require('react-native').Platform.OS = originalPlatform
  })

  it('fixes the board to TABLE_WIDTH_TO_HEIGHT_RATIO on wide desktop web viewports', () => {
    require('react-native').Platform.OS = 'web'
    const board = computeBoardLayout(2000, 900, insets, 'medium') // width is the tight constraint here
    expect(board.width / board.height).toBeCloseTo(TABLE_WIDTH_TO_HEIGHT_RATIO, 3)
    expect(board.width).toBeLessThan(2000) // letterboxing actually engaged, not just a coincidence
  })

  it('does not letterbox on native/mobile - the board fills the viewport exactly, whatever its shape', () => {
    require('react-native').Platform.OS = 'ios'
    const board = computeBoardLayout(2000, 900, insets, 'medium')
    expect(board.width).toBeCloseTo(2000, 5)
    expect(board.height).toBeCloseTo(900, 5)
  })
})

describe('centerBall / centerPaddle / clampPaddleY', () => {
  it('centerBall places the ball at the exact board center', () => {
    const board = computeBoardLayout(900, 400, insets, 'medium')
    const c = centerBall(board)
    expect(c.x).toBeCloseTo(board.centerX, 5)
    expect(c.y).toBeCloseTo(board.centerY, 5)
  })

  it('centerPaddle places each player at their own FIXED X, board center Y', () => {
    const board = computeBoardLayout(900, 400, insets, 'medium')
    const p1 = centerPaddle(board, 1)
    const p2 = centerPaddle(board, 2)
    expect(p1.x).toBeCloseTo(board.paddleX[1], 5)
    expect(p2.x).toBeCloseTo(board.paddleX[2], 5)
    expect(p1.y).toBeCloseTo(board.centerY, 5)
    expect(p2.y).toBeCloseTo(board.centerY, 5)
  })

  it('clampPaddleY clamps to [paddleMinY, paddleMaxY] and leaves an in-range value untouched', () => {
    const board = computeBoardLayout(900, 400, insets, 'medium')
    expect(clampPaddleY(board.y - 1000, board)).toBeCloseTo(board.paddleMinY, 5)
    expect(clampPaddleY(board.y + board.height + 1000, board)).toBeCloseTo(board.paddleMaxY, 5)
    expect(clampPaddleY(board.centerY, board)).toBeCloseTo(board.centerY, 5)
  })
})

// An iPhone 15's court, turned: its length is the screen's height inside the safe areas, its width
// across the screen's width.
const phone = computeBoardLayout(852 - 59 - 34, 393, insets, 'medium')

describe('buildSoloBrickField', () => {
  const board = computeBoardLayout(900, 400, insets, 'medium')
  const bricks = buildSoloBrickField(board)

  it('produces exactly SOLO_BRICK_ROWS * SOLO_BRICKS_PER_ROW bricks', () => {
    expect(bricks).toHaveLength(SOLO_BRICK_ROWS * SOLO_BRICKS_PER_ROW)
  })

  it('every brick starts undestroyed and fully within the board rect', () => {
    expect(bricks.every((b) => !b.destroyed)).toBe(true)
    expect(bricks.every((b) => withinBoard(b, board))).toBe(true)
  })

  it('no two bricks share a position - a real grid, not a stack of overlapping rects', () => {
    const positions = new Set(bricks.map((b) => `${b.x},${b.y}`))
    expect(positions.size).toBe(bricks.length)
  })

  // Jay (2026-11-07): the bricks were huge, taller than wide on a phone.
  it("is the classic's shape on a phone: bricks about 47pt across and 15pt deep, three times as wide as deep", () => {
    for (const b of buildSoloBrickField(phone)) {
      expect(b.height).toBeCloseTo(46.8, 0)
      expect(b.width).toBeCloseTo(15.3, 0)
    }
  })

  it('runs wall to wall across the court, rows stacked toward the far wall with three rows of empty court beyond them', () => {
    const field = buildSoloBrickField(phone)
    const depth = phone.height * BRICK_DEPTH_RATIO
    expect(Math.min(...field.map((b) => b.y))).toBeLessThan(phone.y + 2)
    expect(Math.max(...field.map((b) => b.y + b.height))).toBeGreaterThan(phone.y + phone.height - 2)
    const farEdge = Math.max(...field.map((b) => b.x + b.width))
    expect(phone.x + phone.width - farEdge).toBeGreaterThan(depth * SOLO_BRICK_FAR_GAP_ROWS)
    expect(phone.x + phone.width - farEdge).toBeLessThan(depth * (SOLO_BRICK_FAR_GAP_ROWS + 1))
    // Most of the court, from player 1's paddle on, is open runway.
    expect(Math.min(...field.map((b) => b.x)) - phone.x).toBeGreaterThan(phone.width * 0.7)
  })
})

describe('buildSharedBrickField', () => {
  const board = computeBoardLayout(900, 400, insets, 'medium')
  const bricks = buildSharedBrickField(board)

  it('produces exactly SHARED_BRICK_ROWS * SHARED_BRICKS_PER_ROW bricks, fewer than the solo field', () => {
    expect(bricks).toHaveLength(SHARED_BRICK_ROWS * SHARED_BRICKS_PER_ROW)
    expect(bricks.length).toBeLessThan(buildSoloBrickField(board).length)
  })

  it('every brick starts undestroyed and fully within the board rect', () => {
    expect(bricks.every((b) => !b.destroyed)).toBe(true)
    expect(bricks.every((b) => withinBoard(b, board))).toBe(true)
  })

  it("never overlaps either paddle's reachable column - centered on the court, paddles fixed at their own X", () => {
    const halfW = board.paddleWidth / 2
    const p1Right = board.paddleX[1] + halfW
    const p2Left = board.paddleX[2] - halfW
    expect(bricks.every((b) => b.x >= p1Right && b.x + b.width <= p2Left)).toBe(true)
  })

  it('is a thin band across the middle, its bricks the same shape as alone, short of each side wall where the scores sit', () => {
    const field = buildSharedBrickField(phone)
    const near = Math.min(...field.map((b) => b.x))
    const far = Math.max(...field.map((b) => b.x + b.width))
    expect((near + far) / 2).toBeCloseTo(phone.centerX, 5)
    expect(far - near).toBeLessThan(phone.height * BRICK_DEPTH_RATIO * SHARED_BRICK_ROWS)
    expect(Math.min(...field.map((b) => b.y)) - phone.y).toBeGreaterThan(phone.height * SHARED_BRICK_FIELD_Y_MARGIN_RATIO)
    expect(phone.y + phone.height - Math.max(...field.map((b) => b.y + b.height))).toBeGreaterThan(phone.height * SHARED_BRICK_FIELD_Y_MARGIN_RATIO)
    for (const b of field) {
      expect(b.width).toBeCloseTo(15.3, 0)
      expect(b.height).toBeGreaterThan(b.width * 2)
    }
  })
})

describe('servingBall', () => {
  const paddles = { 1: { x: phone.paddleX[1], y: phone.paddleMinY + 10, vx: 0, vy: 0 }, 2: { x: phone.paddleX[2], y: phone.paddleMaxY - 10, vx: 0, vy: 0 } }

  it("rests just off the serving paddle's face, on the court side, level with its middle", () => {
    const one = servingBall(phone, paddles, 1)
    const two = servingBall(phone, paddles, 2)
    expect(one.y).toBe(paddles[1].y)
    expect(two.y).toBe(paddles[2].y)
    const clear = phone.paddleWidth / 2 + phone.ballRadius
    expect(one.x - phone.paddleX[1]).toBeGreaterThan(clear)
    expect(one.x - phone.paddleX[1]).toBeLessThan(clear + phone.ballRadius)
    expect(phone.paddleX[2] - two.x).toBeCloseTo(one.x - phone.paddleX[1], 5)
  })
})
