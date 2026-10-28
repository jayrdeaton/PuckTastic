// On desktop web every play screen keeps its back and settings chips up in the page's top corners
// (8px in and 40px across, the play screens' backSlot/settingsSlot), so a board drawn into those
// corners sits under them. A desktop board layout keeps this much of the window clear of anything it
// draws, down both sides or across the top and bottom.
export const DESKTOP_CHIP_BAND = 56

// The biggest box of `ratio` (width / height) that fits `availableWidth` x `availableHeight`, centered
// there, with its `overhang` (a wall drawn outside it) kept DESKTOP_CHIP_BAND clear of both side
// edges or of the top and bottom edges, whichever leaves the bigger box. A board that already leaves
// that room gets its full size. Clear of all four corners, so a board drawn turned a quarter (a
// window taller than wide) clears the chips too.
export function fitClearOfCornerChips(availableWidth: number, availableHeight: number, ratio: number, overhang = 0): { width: number; height: number } {
  const clear = 2 * (DESKTOP_CHIP_BAND + overhang)
  const sides = fitRatio(availableWidth - clear, availableHeight, ratio)
  const ends = fitRatio(availableWidth, availableHeight - clear, ratio)
  return sides.width >= ends.width ? sides : ends
}

function fitRatio(width: number, height: number, ratio: number): { width: number; height: number } {
  const w = Math.max(0, width)
  const h = Math.max(0, height)
  return w / ratio > h ? { width: h * ratio, height: h } : { width: w, height: w / ratio }
}
