import type { EdgeInsets } from 'react-native-safe-area-context'

// How far a floating label or chip keeps from the safe area's edge.
export const ON_SCREEN_PAD = 8

/** Keeps a floating element centered at `center`, `halfWidth` by `halfHeight` either side of it, inside the window's safe area and
 * ON_SCREEN_PAD clear of its edges. The score labels and back/settings chips are placed near the court's own corners, and on an iPad the
 * court reaches the window's edge, where an element centered just inside a corner would otherwise hang half off it. Where an element
 * already fits (a phone, whose court sits inside wide insets), this changes nothing. */
export function keepOnScreen(center: { x: number; y: number }, halfWidth: number, halfHeight: number, window: { width: number; height: number }, insets: EdgeInsets): { x: number; y: number } {
  const minX = insets.left + ON_SCREEN_PAD + halfWidth
  const maxX = window.width - insets.right - ON_SCREEN_PAD - halfWidth
  const minY = insets.top + ON_SCREEN_PAD + halfHeight
  const maxY = window.height - insets.bottom - ON_SCREEN_PAD - halfHeight
  return { x: Math.min(Math.max(center.x, minX), maxX), y: Math.min(Math.max(center.y, minY), maxY) }
}
