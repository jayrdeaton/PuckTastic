import { IconButton } from '@rific/feedback-press'
import { useEffect } from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

export interface MatchChipsProps {
  /** Up and pressable between points and at Game Over; faded out and untouchable while the puck is in play, so they never cover it. */
  visible: boolean
  /** Where each chip's 48pt box sits (absolute position, plus a height when it's centered in a band). */
  backSlot: ViewStyle
  settingsSlot: ViewStyle
  /** The chip's fill and its icon's color. */
  fg: string
  bg: string
  onBack: () => void
  onSettings: () => void
}

/** The in-match back and settings chips of Air Hockey, Paddles and Breaker, faded the way Box Hockey's are: out over 150ms when play
 * starts, back when it stops. Each game decides when play is on (desktop web keeps them up through every phase) and where they sit. */
export function MatchChips({ visible, backSlot, settingsSlot, fg, bg, onBack, onSettings }: MatchChipsProps) {
  const opacity = useSharedValue(visible ? 1 : 0)
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 150 })
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  const pointerEvents = visible ? 'box-none' : 'none'
  return (
    <>
      <Animated.View pointerEvents={pointerEvents} style={[styles.slot, backSlot, fadeStyle]}>
        <IconButton icon='arrow-left' iconColor={bg} containerColor={fg} style={styles.chip} size={24} onPress={onBack} accessibilityLabel='Back' />
      </Animated.View>
      <Animated.View pointerEvents={pointerEvents} style={[styles.slot, settingsSlot, fadeStyle]}>
        <IconButton icon='cog' iconColor={bg} containerColor={fg} style={styles.chip} size={24} onPress={onSettings} accessibilityLabel='Settings' />
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  chip: { margin: 0 },
  slot: { justifyContent: 'center', position: 'absolute' }
})
