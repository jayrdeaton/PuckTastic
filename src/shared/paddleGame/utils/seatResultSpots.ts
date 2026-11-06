import type { Player } from '@/shared/paddleGame/types'
import type { SeatToastSpot } from '@/shared/SeatToasters'

/** One 2 Player seat's Game Over card: the half of the screen that's theirs and the angle it's turned to face them (SeatToasters'
 * SeatToastSpot). */
export type SeatSpot = SeatToastSpot

/** Where each 2 Player seat's Game Over card goes, from the court's rotation (the play screen's `rotation`): each player's half is their
 * touch zone (TouchInputLayer's zoneA for player 1), and the card faces that half's outer edge, where they sit. A turned court (a tall
 * window: every 2 Player match on a phone, face to face) puts player 1 at the bottom and player 2 across from them; an unturned one (a wide
 * window: a landscape iPad, a browser window) is side by side, player 1 on the left, both upright. A computer screen keeps both upright,
 * since its players sit side by side whatever its shape. */
export function seatResultSpots(courtRotation: 0 | -90, desktopWeb: boolean): Record<Player, SeatSpot> {
  if (courtRotation === 0) return { 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } }
  return { 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: desktopWeb ? 0 : 180, zone: 'top' } }
}
