import { useEffect, useRef } from 'react'

import { AI_AIM_WANDER_SMOOTHING_FRAMES } from '@/shared/paddleGame/constants/game'
import { BoardLayout, GameState, Player } from '@/shared/paddleGame/types'
import { AIDifficulty, computeAIPaddleTarget } from '@/shared/paddleGame/utils/aiOpponent'

// Decides after every physics tick (useGameState's onStep, called with the live state), so it rides
// the same cadence useGameState's own useGameLoop already drives rather than a separate rAF/interval
// loop of its own. It used to re-run on every render, when every tick rendered; a tick that only
// moves the ball and paddles doesn't any more (see useMotionReducer). setPaddleTarget is the EXACT
// SAME function TouchInputLayer's gesture callbacks call for a human - this is what preserves
// AirHockey's "AI plays through the human's own input contract" principle at continuous
// granularity: the AI never touches TICK dispatch, paddle velocity computation, or collision
// differently than a human's touch does, it only ever supplies a different SOURCE of a target Y
// (setPaddleTarget's own public signature simplifies from AirHockey's (player, x, y) to (player, y) -
// see useGameState.ts - since a Pong paddle's X is permanently fixed by board.paddleX[player], never
// a live input).
export function useAIOpponent(state: GameState, board: BoardLayout, aiPlayer: Player | null, difficulty: AIDifficulty, paused: boolean, setPaddleTarget: (player: Player, y: number) => void, onStep: (listener: (state: GameState) => void) => () => void): void {
  // Smoothed noise source for computeAIPaddleTarget's own `random` param (see AI_AIM_WANDER_SMOOTHING_
  // FRAMES's own doc comment) - persisted across ticks and re-EMA'd toward a fresh Math.random() draw
  // each time, rather than passing Math.random itself straight through. computeAIPaddleTarget only
  // ever calls `random()` once per invocation, so smoothing what that single call returns is enough to
  // turn its jitter into a slow wander without touching computeAIPaddleTarget (or its own maxApproach
  // Speed step-limiting, which must keep reacting at full speed to the ball's genuine, non-jittery
  // motion) at all. Seeded at 0.5 - the zero-jitter point (see aiOpponent.test.ts's own noJitter
  // convention) - rather than an initial Math.random() call, which render-time purity rules forbid;
  // the EMA below pulls it toward real draws within the very first live tick regardless.
  const wanderRef = useRef(0.5)

  useEffect(() => {
    if (aiPlayer === null || paused || state.phase !== 'live') return
    return onStep((live) => {
      if (live.phase !== 'live') return
      wanderRef.current += (Math.random() - wanderRef.current) / AI_AIM_WANDER_SMOOTHING_FRAMES
      const target = computeAIPaddleTarget(live.ball, live.paddles[aiPlayer], board, aiPlayer, difficulty, () => wanderRef.current)
      setPaddleTarget(aiPlayer, target.y)
    })
  }, [state.phase, aiPlayer, difficulty, paused, board, setPaddleTarget, onStep])
}
