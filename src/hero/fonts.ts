import { MONO_FONT } from '@tastic/hud'
import type { TextStyle } from 'react-native'

// The pack's title lettering (PackDefinition.titleStyle): the wordmark's monospace (hud's MONO_FONT, Menlo on iOS and the
// system monospace elsewhere, nothing to load), laid over each title's own type, so every title reads like the hero and the
// match cards. The shell hands it to Home's game cards, each loadout's header, the stats screen's title and game headings,
// every hud dialog's title (Settings, How to Play, Quit Match?, Paused, the update prompt) and @tastic/profile's Profiles and
// Edit Profile titles (0.27+). Each title keeps its own size and weight (the shell's are bold, as the wordmark is). Small
// labels (the pills, tabs and section headings) keep Paper's font: the pack sets no labelStyle.
export const titleType: TextStyle = { fontFamily: MONO_FONT }
