import type { Player } from '@/games/boxhockey/types'
import type { SeatToastSpot } from '@/shared/SeatToasters'

/** Where each 2 Player seat's unlock toasts go (SeatToasters): the half of the screen that's theirs, turned the way they read it. Side by
 * side, each player's stack stays on their own half, so three toasts for one and one for the other are two stacks, one on each side (Jay,
 * 2026-10-20). `atComputer` is the shell's useAtComputer: the web without a touch-first screen, at any width (Jay, 2026-11-07: face to
 * face only on a phone or tablet, natively or in its browser). */
export function seatToastSpots(atComputer: boolean): Record<Player, SeatToastSpot> {
  // At a computer: side by side, upright, player 1 on the left (A/D) and player 2 on the right (the arrows), whatever the window's shape.
  if (atComputer) return { 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } }
  // On a phone or tablet the board is face to face in any window, a landscape iPad included, and its touch zones with it: player 1 at the
  // bottom, player 2 across the table, turned 180.
  return { 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } }
}
