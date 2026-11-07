import { games } from '@/pack'

// How each game's 2 Player loadout seats its players (the shell's sideBySideAtComputer and
// sideBySideWhenWide), the same way its match seats them: side by side at a computer in every game,
// whatever the window's shape (Jay, 2026-11-07: face to face only on a phone or tablet, natively or in
// its browser). On a phone or tablet Box Hockey stays face to face in any window, on its fixed board,
// and Air Hockey, Paddles and Breaker follow the window's shape.

const byId = Object.fromEntries(games.map((game) => [game.id, game]))

describe("the 2 Player loadout's seating", () => {
  it('sits side by side at a computer in every game with a second player', () => {
    for (const game of games) if (game.seatTwo?.includes('person')) expect(game.sideBySideAtComputer).toBe(true)
  })

  it("follows the window's shape on a phone or tablet in every game but Box Hockey", () => {
    expect(byId.boxhockey.sideBySideWhenWide).toBeUndefined()
    for (const id of ['airhockey', 'paddles', 'breaker']) expect(byId[id].sideBySideWhenWide).toBe(true)
  })
})
