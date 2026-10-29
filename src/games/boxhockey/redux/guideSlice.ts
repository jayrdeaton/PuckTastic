import { createGameGuideSlice } from '@tastic/shell'

import { GUIDE_VERSION } from '@/games/boxhockey/constants/guide'

// Which version of Box Hockey's How to Play cards this player has finished or skipped, under its own
// store key, like every game's (see createGameGuideSlice: a saved store without it reads as not seen).
const slice = createGameGuideSlice('boxhockeyGuide')

export { GUIDE_VERSION }
export const guideActions = slice.actions
export const selectGuideVersionSeen = slice.selectVersionSeen
export default slice.reducer
