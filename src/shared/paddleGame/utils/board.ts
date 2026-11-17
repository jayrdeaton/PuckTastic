import { Platform } from 'react-native'
import { EdgeInsets } from 'react-native-safe-area-context'

import { fitClearOfCornerChips } from '@/shared/desktopChips'
import { BALL_RADIUS_RATIO, BRICK_DEPTH_RATIO, BRICK_GAP_RATIO, DESKTOP_WEB_MIN_WIDTH, PADDLE_HEIGHT_RATIOS, PADDLE_INSET_RATIO, PADDLE_WIDTH_RATIO, SERVE_REST_GAP_RADII, SHARED_BRICK_FIELD_Y_MARGIN_RATIO, SHARED_BRICK_ROWS, SHARED_BRICKS_PER_ROW, SOLO_BRICK_FAR_GAP_ROWS, SOLO_BRICK_ROWS, SOLO_BRICKS_PER_ROW, TABLE_WIDTH_TO_HEIGHT_RATIO, WALL_THICKNESS } from '@/shared/paddleGame/constants/game'
import { BoardLayout, Brick, PaddleSizeLevel, PaddleStates, Player } from '@/shared/paddleGame/types'

// Mirrors AirHockey's own isDesktopLayout - desktop web is the only context that fixes the board
// to a fixed aspect ratio (TABLE_WIDTH_TO_HEIGHT_RATIO) rather than filling the viewport exactly.
// Native and mobile web fill their container exactly, so the device's own physical edge already
// reads as the boundary with zero gap. On desktop the court and its walls also keep clear of the back
// and settings chips in the page's top corners (fitClearOfCornerChips).
function isDesktopLayout(screenWidth: number): boolean {
  return Platform.OS === 'web' && screenWidth >= DESKTOP_WEB_MIN_WIDTH
}

export function computeViewportSize(screenWidth: number, screenHeight: number, insets: EdgeInsets): { width: number; height: number } {
  return { width: screenWidth - insets.left - insets.right, height: screenHeight - insets.top - insets.bottom }
}

// No goalAxis/rotation parameter at all - unlike AirHockey's computeBoardLayout, board/physics/AI
// stay in canonical local space always (paddles at local-left/local-right, ball travels along
// local X). The rendering layer (the play screen) is what turns this local space onto the real
// screen - see the note below - so this function never needs to know the window's shape; the play
// screen alone decides which real width/height to feed it based on the live orientationMode.
// desktop: whether the court takes its computer shape. The play screen passes its own check (the
// window's width), since it hands this a turned court's length as its width: a phone browser's 812pt
// screen height passed DESKTOP_WEB_MIN_WIDTH and got the letterboxed computer court without its walls.
export function computeBoardLayout(screenWidth: number, screenHeight: number, insets: EdgeInsets, paddleSize: PaddleSizeLevel = 'medium', desktop: boolean = isDesktopLayout(screenWidth)): BoardLayout {
  const { width: availableWidth, height: availableHeight } = computeViewportSize(screenWidth, screenHeight, insets)

  let width = availableWidth
  let height = availableHeight
  if (desktop) {
    const fit = fitClearOfCornerChips(availableWidth, availableHeight, TABLE_WIDTH_TO_HEIGHT_RATIO, WALL_THICKNESS)
    width = fit.width
    height = fit.height
  }

  const x = insets.left + (availableWidth - width) / 2
  const y = insets.top + (availableHeight - height) / 2

  const ballRadius = height * BALL_RADIUS_RATIO
  const paddleHeight = height * PADDLE_HEIGHT_RATIOS[paddleSize]
  const paddleWidth = height * PADDLE_WIDTH_RATIO
  const paddleInset = width * PADDLE_INSET_RATIO

  return {
    x,
    y,
    width,
    height,
    wallThickness: WALL_THICKNESS,
    ballRadius,
    paddleWidth,
    paddleHeight,
    paddleX: { 1: x + paddleInset, 2: x + width - paddleInset },
    paddleMinY: y + paddleHeight / 2,
    paddleMaxY: y + height - paddleHeight / 2,
    centerX: x + width / 2,
    centerY: y + height / 2
  }
}

export function centerBall(board: BoardLayout): { x: number; y: number } {
  return { x: board.centerX, y: board.centerY }
}

export function centerPaddle(board: BoardLayout, player: Player): { x: number; y: number } {
  return { x: board.paddleX[player], y: board.centerY }
}

// Where Breaker's puck rests before a serve: just off the serving paddle's face, level with its
// middle, so it rides along with the paddle until it's served (see useGameState). Paddles serves from
// the middle instead (centerBall).
export function servingBall(board: BoardLayout, paddles: PaddleStates, server: Player): { x: number; y: number } {
  const offset = board.paddleWidth / 2 + board.ballRadius * (1 + SERVE_REST_GAP_RADII)
  return { x: board.paddleX[server] + (server === 1 ? offset : -offset), y: paddles[server].y }
}

// The full equivalent of AirHockey's clampToOwnHalf, just narrower: a Pong paddle only ever moves
// on Y (its X is permanently fixed by board.paddleX), and it covers the full court height rather
// than half of it - there's no "own half" concept left once nothing behind the paddle needs
// defending. Shared by TouchInputLayer's setPaddleTarget (a human's live drag) and aiOpponent's
// target selection, same as AirHockey.
export function clampPaddleY(y: number, board: BoardLayout): number {
  return Math.min(board.paddleMaxY, Math.max(board.paddleMinY, y))
}

// Fills [x0,x1] x [y0,y1] with `rows` rows of bricks stacked along the court's length (x), each row
// `perRow` bricks across it (y), each brick inset by `gap` (split evenly on both sides) so neighboring
// bricks never touch. x/y are top-left corners, matching @tastic/physics's circleVsRect and
// ObstacleRect's own rect convention (not center-based, unlike a paddle rect - see
// applyPaddleCollision's own center-to-corner conversion in utils/physics.ts).
function packBrickRows(x0: number, y0: number, x1: number, y1: number, rows: number, perRow: number, gap: number): Brick[] {
  const rowDepth = (x1 - x0) / rows
  const brickSpan = (y1 - y0) / perRow
  const bricks: Brick[] = []
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < perRow; i++) {
      bricks.push({ x: x0 + row * rowDepth + gap / 2, y: y0 + i * brickSpan + gap / 2, width: rowDepth - gap, height: brickSpan - gap, destroyed: false })
    }
  }
  return bricks
}

// The field alone: rows wall to wall across the court, near the far wall (where player 2's paddle
// would be), with SOLO_BRICK_FAR_GAP_ROWS rows' worth of empty court beyond them.
export function buildSoloBrickField(board: BoardLayout): Brick[] {
  const gap = board.height * BRICK_GAP_RATIO
  const depth = board.height * BRICK_DEPTH_RATIO
  const x1 = board.x + board.width - depth * SOLO_BRICK_FAR_GAP_ROWS
  const x0 = x1 - depth * SOLO_BRICK_ROWS
  return packBrickRows(x0, board.y, x1, board.y + board.height, SOLO_BRICK_ROWS, SOLO_BRICKS_PER_ROW, gap)
}

// The head to head field: a thin band across the middle of the court, short of each side wall. A
// paddle only ever moves in Y at a fixed X (board.paddleX), so a band centered on centerX can never
// overlap either paddle's reachable area.
export function buildSharedBrickField(board: BoardLayout): Brick[] {
  const gap = board.height * BRICK_GAP_RATIO
  const halfDepth = (board.height * BRICK_DEPTH_RATIO * SHARED_BRICK_ROWS) / 2
  const margin = board.height * SHARED_BRICK_FIELD_Y_MARGIN_RATIO
  return packBrickRows(board.centerX - halfDepth, board.y + margin, board.centerX + halfDepth, board.y + board.height - margin, SHARED_BRICK_ROWS, SHARED_BRICKS_PER_ROW, gap)
}

// NOTE on the orientation layer built on top of this: when the live orientationMode is
// 'sideBySide', local space maps directly onto the screen (width=local width, height=local height,
// screenWidth/screenHeight passed straight through). When 'faceToFace', the container hosting the
// board+TouchInputLayer tree is turned -90°, and computeBoardLayout must be called with
// the SWAPPED dimensions (screenHeight passed as screenWidth and vice versa) so the local rect
// still comes out sized correctly for its own rotated container - mirrors AirHockey's original
// computeLocalContainerSize's short/long swap, just resolved one level up in game.tsx rather than
// inside board.ts itself (board.ts stays orientation-agnostic; game.tsx decides which real
// width/height to feed it based on live orientationMode).
