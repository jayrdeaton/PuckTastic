// Whether backing out of a hockey match costs anything, so Quit Match? asks first (the back chip,
// Android's back and the browser's back, through @tastic/shell's useBackBlock): once there's a goal
// to lose, and not once the match is over (gameOver), when its stats are already recorded and back
// exits at once, the same as the Game Over card's own buttons. 0-0 exits immediately, since there's
// nothing yet for a confirmation to protect. Box Hockey's and Air Hockey's play screens; Paddles and
// Breaker count a lost life or a broken brick too (paddleGame/PlayScreen.tsx).
export function matchHasProgress(phase: string, scores: readonly [number, number]): boolean {
  return phase !== 'gameOver' && (scores[0] > 0 || scores[1] > 0)
}
