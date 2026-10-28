import { DEFAULT_SETTINGS, playerSettings } from '@/games/boxhockey/redux/settingsSlice'

// The per-player behavior itself is shared/playerSettings.ts's, tested in playerSettings.test.tsx.
// The shell's own appSettingsSlice is tested beside it (shell/__tests__/appSettingsSlice.test.ts).
describe("Box Hockey's per-player settings", () => {
  it('are saved under boxhockeySettings and boxhockeyControls', () => {
    expect(Object.keys(playerSettings.reducers)).toEqual(['boxhockeySettings', 'boxhockeyControls'])
  })

  // A player's saved setup only holds what they changed, so a field added since starts at its default.
  it('fill what a player never changed from the defaults', () => {
    expect(playerSettings.compose({ sam: { boardVariant: 'gauntlet' } }, {}, { 1: 'sam', 2: null }, false)).toEqual({ ...DEFAULT_SETTINGS, boardVariant: 'gauntlet' })
  })

  it('let both seats play the same shot style', () => {
    expect(playerSettings.compose({}, { sam: 'stick', riley: 'stick' }, { 1: 'sam', 2: 'riley' }, true).controlScheme).toEqual({ 1: 'stick', 2: 'stick' })
  })
})
