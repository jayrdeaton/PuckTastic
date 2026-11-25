import { IconButton } from '@rific/feedback-press'
import { MenuOption, PopoverHost, SectionedDropdown, usePopoverHost } from '@tastic/hud'
import { StyleSheet, View } from 'react-native'

import { BoardVariant, FrictionLevel, InterceptSpeed, PuckSizeLevel, ShotPreviewLength, TipoffMode } from '@/games/boxhockey/types'

interface Props {
  // Shared popover host - see PlayerSetupPanel's identical `host` prop. loadout.tsx always passes
  // its own controlsHost here, in every game mode: this row sits in the same near/bottom zone as
  // P1's own panel, so board variant/score/difficulty need to be mutually exclusive with P1's color
  // picker (only one of them can be open at a time), and - just as importantly - P1's press-away
  // overlay only watches controlsHost.openId, so a dropdown opened on any *other* host would be
  // invisible to it and never close on an outside tap. Omit only if some future caller genuinely
  // wants this row fully independent (own host, own press-away wiring it'd have to provide itself).
  host?: PopoverHost
  boardVariant: BoardVariant
  boardVariantOptions: MenuOption<BoardVariant>[]
  onBoardVariantChange: (value: BoardVariant) => void
  // Rides along in the same popover as boardVariant, as a second (multi-select, single-item)
  // section - see the render below. A real boolean now rather than an 'on' | 'off' string: that
  // encoding only existed because the old single-select row couldn't take a raw boolean value;
  // representing it as a one-item multi-select section instead (present in the value array = on)
  // needs no such workaround, and is what gives it the checkbox-style highlight-when-on look.
  rink: boolean
  rinkOption: MenuOption<'on'>
  onRinkChange: (value: boolean) => void
  friction: FrictionLevel
  frictionOptions: MenuOption<FrictionLevel>[]
  onFrictionChange: (value: FrictionLevel) => void
  puckSize: PuckSizeLevel
  puckSizeOptions: MenuOption<PuckSizeLevel>[]
  onPuckSizeChange: (value: PuckSizeLevel) => void
  interceptSpeed: InterceptSpeed
  interceptSpeedOptions: MenuOption<InterceptSpeed>[]
  onInterceptSpeedChange: (value: InterceptSpeed) => void
  scoreToWin: number
  scoreToWinOptions: MenuOption<number>[]
  onScoreToWinChange: (value: number) => void
  shotPreviewLength: ShotPreviewLength
  shotPreviewLengthOptions: MenuOption<ShotPreviewLength>[]
  onShotPreviewLengthChange: (value: ShotPreviewLength) => void
  tipoffMode: TipoffMode
  tipoffModeOptions: MenuOption<TipoffMode>[]
  onTipoffModeChange: (value: TipoffMode) => void
  // Both one-shot actions on the settings above as a whole, not a value with a "current state" to
  // show - rendered as plain IconButtons in their own row above the trigger row (not a
  // SectionedDropdown trigger itself, which would misleadingly suggest a selected value to land
  // on). Optional (and always passed as a pair) - loadout.tsx's own showMetaInSharedBand case
  // renders these itself, inline in its merged back/dice/reset/settings header row, so this
  // component leaves its own row out entirely rather than showing the same two actions twice.
  onRandomize?: () => void
  onReset?: () => void
  accentColor: string
  mutedColor: string
  onAccentColor?: string
  dark: boolean
}

// Always-upright row of shared (not per-player) settings in the loadout screen. Shares P1's popover
// host (passed in by loadout.tsx in every game mode - see the `host` prop above) rather than owning
// an independent one, so this row participates in P1's mutual-exclusivity and press-away wiring the
// same way P1's own panel does. Exported so loadout.tsx's own SharedActionBand wrapper can run this
// same "is one of my own popovers open" membership check on itself - see @tastic/hud's
// SharedActionBand for why it needs to.
export const LOADOUT_SHARED_CONTROLS_IDS = ['boardVariant', 'friction', 'puckSize', 'slapShot', 'matchRules', 'shotPreviewLength']

export function LoadoutSharedControls({ host: sharedHost, boardVariant, boardVariantOptions, onBoardVariantChange, rink, rinkOption, onRinkChange, friction, frictionOptions, onFrictionChange, puckSize, puckSizeOptions, onPuckSizeChange, interceptSpeed, interceptSpeedOptions, onInterceptSpeedChange, scoreToWin, scoreToWinOptions, onScoreToWinChange, shotPreviewLength, shotPreviewLengthOptions, onShotPreviewLengthChange, tipoffMode, tipoffModeOptions, onTipoffModeChange, onRandomize, onReset, accentColor, mutedColor, onAccentColor, dark }: Props) {
  const ownHost = usePopoverHost()
  const host = sharedHost ?? ownHost
  // See PlayerSetupPanel's identical ownPopoverOpen comment - elevating this row for *any* open
  // popover on a shared host (rather than only its own) would tie it with whichever sibling panel
  // actually has the open popover, letting DOM order wrongly decide which one paints on top.
  const ownPopoverOpen = host.openId !== null && LOADOUT_SHARED_CONTROLS_IDS.includes(host.openId)
  // Same fg convention as every other component keying off a `dark` prop - full-contrast, unlike
  // mutedColor/accentColor above, which are tuned for a TriggerGauge's own unselected/selected
  // states rather than a plain icon button. Matches LightCycles' LobbySharedControls exactly.
  const fg = dark ? '#FFFFFF' : '#000000'

  return (
    <View style={[styles.container, ownPopoverOpen && styles.containerOpen]}>
      {onRandomize && onReset && (
        <View style={styles.actionsRow}>
          <IconButton icon='dice-multiple' iconColor={fg} size={18} onPress={onRandomize} accessibilityLabel='Randomize match settings' />
          <IconButton icon='restore' iconColor={fg} size={18} onPress={onReset} accessibilityLabel='Reset match settings to defaults' />
        </View>
      )}

      <View style={styles.row}>
        {/* Board variant (single-select: which layout) and rink (multi-select with just one
      possible item: on or off) share one popover - rink isn't really "another board option," it's
      a toggle riding along in the same menu, styled like a multiselect row (checkbox + highlight
      when on) rather than a second radio choice. */}
        <SectionedDropdown
          id='boardVariant'
          host={host}
          icon='view-grid-outline'
          accessibilityLabel='Board'
          sections={[
            { kind: 'single', id: 'boardVariant', options: boardVariantOptions, value: boardVariant, onChange: onBoardVariantChange },
            { kind: 'multi', id: 'rink', options: [rinkOption], value: rink ? ['on'] : [], onChange: (value) => onRinkChange(value.length > 0) }
          ]}
          accentColor={accentColor}
          mutedColor={mutedColor}
          onAccentColor={onAccentColor}
          dark={dark}
        />

        {/* Puck speed and puck size each have their own trigger, each menu titled with its name (hud's
      SectionedDropdown title, its accessibilityLabel): Jay, 2026-11-25, "there is plenty of space for
      extra dials". They were one "Puck physics" menu behind the speedometer, as Air Hockey's were
      before theirs were split. */}
        <SectionedDropdown id='friction' host={host} icon='speedometer-medium' accessibilityLabel='Puck speed' sections={[{ kind: 'single', id: 'friction', options: frictionOptions, value: friction, onChange: onFrictionChange }]} accentColor={accentColor} mutedColor={mutedColor} onAccentColor={onAccentColor} dark={dark} />

        <SectionedDropdown id='puckSize' host={host} icon='hockey-puck' accessibilityLabel='Puck size' sections={[{ kind: 'single', id: 'puckSize', options: puckSizeOptions, value: puckSize, onChange: onPuckSizeChange }]} accentColor={accentColor} mutedColor={mutedColor} onAccentColor={onAccentColor} dark={dark} />

        {/* A distinct skill mechanic (mid-slide interception, see InterceptSpeed in types/index.ts),
      not a physics knob like puck speed and size, so it's named for what it does. */}
        <SectionedDropdown id='slapShot' host={host} icon='hockey-sticks' accessibilityLabel='Slap shot' sections={[{ kind: 'single', id: 'interceptSpeed', options: interceptSpeedOptions, value: interceptSpeed, onChange: onInterceptSpeedChange }]} accentColor={accentColor} mutedColor={mutedColor} onAccentColor={onAccentColor} dark={dark} />

        {/* Score to win and tip-off are both "how the match plays out" rules, one menu titled Match
      rules, with the tip-offs headed Tip-off under the divider (a section title, hud 0.39). autoDismiss is off so picking one doesn't close it before the other's been looked at;
      press-away or the trigger closes it. */}
        <SectionedDropdown
          id='matchRules'
          host={host}
          icon='flag-checkered'
          accessibilityLabel='Match rules'
          autoDismiss={false}
          sections={[
            { kind: 'single', id: 'scoreToWin', options: scoreToWinOptions, value: scoreToWin, onChange: onScoreToWinChange },
            { kind: 'single', id: 'tipoffMode', title: 'Tip-off', options: tipoffModeOptions, value: tipoffMode, onChange: onTipoffModeChange }
          ]}
          accentColor={accentColor}
          mutedColor={mutedColor}
          onAccentColor={onAccentColor}
          dark={dark}
        />

        <SectionedDropdown id='shotPreviewLength' host={host} icon='ray-start-arrow' accessibilityLabel='Shot preview length' sections={[{ kind: 'single', id: 'shotPreviewLength', options: shotPreviewLengthOptions, value: shotPreviewLength, onChange: onShotPreviewLengthChange }]} accentColor={accentColor} mutedColor={mutedColor} onAccentColor={onAccentColor} dark={dark} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Above the trigger row - small, secondary-weight (size 18 vs. the triggers' own icon size) so
  // Randomize/Reset read as quick actions on the settings below rather than a seventh setting of
  // equal standing. On top (not below) to match loadout.tsx's own showMetaInSharedBand header row,
  // which folds these same two actions in with back/settings above the triggers there too.
  actionsRow: {
    flexDirection: 'row',
    gap: 12
  },
  container: {
    alignItems: 'center',
    gap: 4
  },
  // See SectionedDropdown's anchorOpen comment - this whole column is itself a sibling of the
  // player panels in loadout.tsx, and React Native Web's per-view stacking contexts mean a popover
  // escaping the row below needs this wrapper elevated, not just the popover content, to paint
  // above a later sibling panel.
  containerOpen: {
    zIndex: 100
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    // Six fixed-size triggers can be wider than a narrow phone, and a row with no wrap runs off the
    // screen edge, taking the last trigger or two with it (untappable, not just clipped). Wrap turns
    // that into a second centered line instead.
    flexWrap: 'wrap',
    // Wider than a plain icon row would need, to give each trigger's TriggerGauge arc (pulled in
    // close around the icon itself - see TriggerGauge's own ARC_GAP) room to breathe against its
    // neighbors. 14, not the 20 Air Hockey's five and the paddle games' rows use, so Box Hockey's six
    // (2026-11-25, puck speed and size split) stay on one line on a 375pt phone (an iPhone SE): its
    // row is 343 wide inside the loadout's 16pt padding, and six 44pt triggers take 334 at 14 (344 at 16).
    gap: 14,
    justifyContent: 'center'
  }
})
