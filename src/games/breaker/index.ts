import { createPaddleGame } from '@/shared/paddleGame/createPaddleGame'

import { GameIcon } from './components/GameIcon'

// Breaker: Paddles with a field of bricks between the paddles, from Pong's Bricks toggle, and a
// round alone (seat 2 set to Nobody) that was Pong's Brickbreaker.
export const breaker = createPaddleGame({
  id: 'breaker',
  title: 'Breaker',
  blurb: 'The classic brick breaker, solo or head to head.',
  icon: GameIcon,
  hasBricks: true,
  guideVersion: 1
})
