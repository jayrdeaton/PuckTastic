import { readFileSync } from 'fs'
import { join } from 'path'

import { LOADOUT_SHARED_CONTROLS_IDS as AIR_HOCKEY_IDS } from '@/games/airhockey/components/LoadoutSharedControls'
import { LOADOUT_SHARED_CONTROLS_IDS as BOX_HOCKEY_IDS } from '@/games/boxhockey/components/LoadoutSharedControls'
import { LOADOUT_SHARED_CONTROLS_IDS as PADDLE_IDS } from '@/shared/paddleGame/components/LoadoutSharedControls'

// Each game's loadout dials (hud's SectionedDropdown, every open menu titled with its accessibilityLabel since hud 0.39). Jay,
// 2026-11-25: the speed dials are split from the size ones ("there is plenty of space for extra dials"), and Air Hockey's paddle size
// keeps its own icon on its trigger, since its options share puck size's circles. The ids each game hands the shell (optionIds, which
// lifts the row while one of its menus is open) are the ids its row draws.

const SRC = join(__dirname, '..')

/** Each SectionedDropdown in a file: its id, label, whether it keeps its own icon and how many sections it holds. */
function dials(file: string) {
  const source = readFileSync(join(SRC, file), 'utf8')
  return [...source.matchAll(/<SectionedDropdown([\s\S]*?)\/>/g)].map(([, body]) => ({
    id: body.match(/\bid='([^']+)'/)![1],
    label: body.match(/accessibilityLabel='([^']+)'/)![1],
    staticIcon: /\bstaticIcon\b/.test(body),
    sections: (body.match(/kind: '/g) ?? []).length
  }))
}

const BOX_HOCKEY = 'games/boxhockey/components/LoadoutSharedControls.tsx'
const AIR_HOCKEY = 'games/airhockey/components/LoadoutSharedControls.tsx'
const PADDLE = 'shared/paddleGame/components/LoadoutSharedControls.tsx'

describe("the loadouts' dials", () => {
  it.each([
    [BOX_HOCKEY, BOX_HOCKEY_IDS],
    [AIR_HOCKEY, AIR_HOCKEY_IDS],
    [PADDLE, PADDLE_IDS]
  ])('%s hands the shell the ids of the dials it draws', (file, ids) => {
    expect(dials(file).map((dial) => dial.id)).toEqual(ids)
  })

  it('give puck speed and every size a dial of its own', () => {
    for (const file of [BOX_HOCKEY, AIR_HOCKEY, PADDLE]) {
      for (const dial of dials(file).filter((d) => /speed|size/i.test(d.label))) expect(dial).toEqual(expect.objectContaining({ sections: 1 }))
    }
    expect(dials(BOX_HOCKEY).map((d) => d.label)).toEqual(expect.arrayContaining(['Puck speed', 'Puck size']))
    expect(dials(PADDLE).map((d) => d.label)).toEqual(expect.arrayContaining(['Paddle size', 'Puck speed']))
  })

  it("keep Air Hockey's paddle size on its own icon, apart from puck size's circles", () => {
    const air = dials(AIR_HOCKEY)
    expect(air.find((d) => d.id === 'paddleSize')?.staticIcon).toBe(true)
    expect(air.find((d) => d.id === 'puckSize')?.staticIcon).toBe(false)
  })
})
