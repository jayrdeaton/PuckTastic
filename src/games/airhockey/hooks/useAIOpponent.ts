import { useEffect, useRef } from 'react'

import { BoardLayout, GameState, Player } from '@/games/airhockey/types'
import { AIDifficulty, computeAIPaddleTarget, rollAIJitter } from '@/games/airhockey/utils/aiOpponent'

// How many physics ticks a single rolled jitter offset is held before rolling a new one. Rolling
// fresh every tick (60/sec) picked a wholly new random aim direction each ~16ms, which reads as
// the paddle visibly vibrating in place rather than as human-like aim imprecision - holding one
// offset for a short burst of ticks, then jumping to a new one, reads as a natural hand tremor.
const JITTER_HOLD_TICKS = 15

// Decides after every physics tick (useGameState's onStep, called with the live state), so it rides
// the same cadence useGameState's own useGameLoop already drives rather than a separate rAF/interval
// loop of its own. It used to re-run on every render, when every tick rendered; a tick that only
// moves the puck and paddles doesn't any more (see useMotionReducer). `setPaddleTarget` is the
// EXACT SAME function TouchInputLayer's gesture callbacks call for a human - this is what preserves
// BoxHockey's "AI plays through the human's own input contract" principle at continuous
// granularity: the AI never touches PADDLE_TARGET dispatch, paddle velocity computation, or
// collision differently than a human's touch does, it only ever supplies a different SOURCE of
// target (x, y) coordinates.
export function useAIOpponent(state: GameState, board: BoardLayout, aiPlayer: Player | null, difficulty: AIDifficulty, paused: boolean, setPaddleTarget: (player: Player, x: number, y: number) => void, onStep: (listener: (state: GameState) => void) => () => void): void {
  const jitterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const ticksUntilRerollRef = useRef(0)

  useEffect(() => {
    if (aiPlayer === null || paused || state.phase !== 'live') return
    return onStep((live) => {
      if (live.phase !== 'live') return
      if (ticksUntilRerollRef.current <= 0) {
        jitterRef.current = rollAIJitter(difficulty)
        ticksUntilRerollRef.current = JITTER_HOLD_TICKS
      }
      ticksUntilRerollRef.current -= 1
      const target = computeAIPaddleTarget(live.puck, live.paddles[aiPlayer], board, aiPlayer, difficulty, jitterRef.current)
      setPaddleTarget(aiPlayer, target.x, target.y)
    })
  }, [state.phase, aiPlayer, difficulty, paused, board, setPaddleTarget, onStep])
}
