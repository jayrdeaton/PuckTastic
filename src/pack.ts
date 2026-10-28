import AsyncStorage from '@react-native-async-storage/async-storage'

import { release } from '@/constants/release'
import { airHockey } from '@/games/airhockey'
import { boxHockey } from '@/games/boxhockey'
import { breaker } from '@/games/breaker'
import { paddles } from '@/games/paddles'
import { HeroTitle } from '@/hero/HeroTitle'
import { createBoxHockey1Import } from '@/importBoxHockey1'
import { createPackStore } from '@/shell/redux/createPackStore'
import type { GameDefinition, PackDefinition } from '@/shell/types'

// PuckTastic: the pack's identity and its games, in Home's order. Box Hockey first: it's the star,
// and the game BoxHockey 1.0 shipped as. The App Store record, bundle id, EAS project and URL scheme
// all stay BoxHockey's (see app.json).
export const games: readonly GameDefinition[] = [boxHockey, airHockey, paddles, breaker]

export const pack: PackDefinition = {
  name: 'PuckTastic',
  wordmark: ['PUCK', 'TASTIC'],
  colorCaption: 'PuckTastic only',
  games,
  // BoxHockey's red (player 1) and blue (player 2), the sticks in Jay's icon art.
  seatColors: { 1: '#f44336', 2: '#2196f3' },
  // No appearance or fontFamily: the theme follows the system's appearance, and Paper keeps its own font.
  // The wordmark stacked over a goal line in the players' colors, with a puck bouncing on it.
  HeroTitle,
  otaVersion: release.otaVersion
}

// The one store, saved under 'pucktastic:root', every game's keys named for it. A BoxHockey 1.0 save
// (under 'boxhockey:root', Box Hockey's keys unprefixed) is copied over once, on the first launch of a
// pack build (see importBoxHockey1.ts). Never change this prefix or a key now: every player would
// start over.
export const { store, persistor } = createPackStore(pack, { keyPrefix: 'pucktastic:', migrate: createBoxHockey1Import(AsyncStorage) })
