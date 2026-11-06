import type { OrientationMode } from '@tastic/core'
import { Platform } from 'react-native'

import type { Player } from '@/games/boxhockey/types'
import type { SeatToastSpot } from '@/shared/SeatToasters'

/** Where each 2 Player seat's unlock toasts go (SeatToasters): the half of the screen that's theirs, turned the way they read it. Side by
 * side, each player's stack stays on their own half, so three toasts for one and one for the other are two stacks, one on each side (Jay,
 * 2026-10-20). `windowMode` is the window's shape (useOrientationState). */
export function seatToastSpots(windowMode: OrientationMode, desktopWeb: boolean, web = Platform.OS === 'web'): Record<Player, SeatToastSpot> {
  // At one monitor, or a browser window wider than tall: side by side, upright, player 1 on the left (A/D) and player 2 on the right (the
  // arrows).
  if (desktopWeb || (web && windowMode === 'sideBySide')) return { 1: { rotation: 0, zone: 'left' }, 2: { rotation: 0, zone: 'right' } }
  // On a device the board is face to face in any window, a landscape iPad included, and its touch zones with it: player 1 at the bottom,
  // player 2 across the table, turned 180.
  return { 1: { rotation: 0, zone: 'bottom' }, 2: { rotation: 180, zone: 'top' } }
}
