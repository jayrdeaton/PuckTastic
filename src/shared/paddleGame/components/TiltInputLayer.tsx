import { trackInterfaceOrientation } from '@tastic/core/interface-orientation'
import { DeviceMotion } from 'expo-sensors'
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import { TILT_UPDATE_INTERVAL_MS } from '@/shared/paddleGame/constants/game'
import { BoardLayout, GamePhase, Player } from '@/shared/paddleGame/types'
import { calibrateTiltBaseline, computeTiltTargetY, TiltBaseline } from '@/shared/paddleGame/utils/tiltInput'

export interface TiltInputLayerProps {
  player: Player
  // tiltControlActiveFor(...) && !paused && phase !== 'gameOver' - same `enabled` convention as
  // Touch/KeyboardInputLayer's own prop of the same name.
  enabled: boolean
  // For detecting a FRESH entry into 'live' (every serve, not just the first) as a recalibration
  // trigger - see the phase effect below.
  phase: GamePhase
  // The court's own drawn turn (the play screen's `rotation`): -90 in a tall window, 0 in a wide one.
  // Read fresh each sample, since an iPad turning mid-round changes it.
  rotation: 0 | -90
  board: BoardLayout
  // This player's CURRENT paddle Y, mirrored every render (not read once) - same pattern
  // KeyboardInputLayer's own `paddleY` prop uses, since (re)calibration needs the FRESH value at
  // the exact moment it fires, not a stale render-time snapshot.
  paddleY: number
  onPaddleTargetY: (player: Player, y: number) => void
}

// Additive on top of TouchInputLayer's own always-on drag input - never disables it, same
// "adds a method, never removes one" precedent KeyboardInputLayer already established (see that
// component's own doc comment). Native-only: expo-sensors never populates DeviceMotionMeasurement's
// own `rotation` field on web (confirmed against ExponentDeviceMotion.web.js - an explicit
// "TODO: Bacon: Can rotation be calculated?" left where it emits everything except that field), so
// there is no tilt signal to read there at all - mirrors KeyboardInputLayer's own Platform gate,
// just inverted (that component is web-only; this one is native-only).
//
// Two independent effects, mirroring KeyboardInputLayer's own split: one owns the sensor
// subscription's lifecycle, the other only watches `phase` to flag a recalibration.
//
// Steering follows the interface orientation (@tastic/core's trackInterfaceOrientation, on
// expo-screen-orientation), since the OS turns the interface on a tablet. A turn mid-round
// recalibrates where the paddle is, as a fresh serve does, so the paddle never jumps; steering stays
// within TILT_MAX_DEG of the serve's hold, well short of what turns the interface. Phones are always
// portrait.
export default function TiltInputLayer({ player, enabled, phase, rotation, board, paddleY, onPaddleTargetY }: TiltInputLayerProps) {
  const latestRef = useRef({ player, rotation, board, paddleY, onPaddleTargetY })
  useEffect(() => {
    latestRef.current = { player, rotation, board, paddleY, onPaddleTargetY }
  })

  const baselineRef = useRef<TiltBaseline | null>(null)
  // Starts true so the very first sample after enabling calibrates rather than steers from a
  // baseline of {0, 0} - see the listener below, which never moves the paddle on a calibrating
  // sample.
  const needsCalibrationRef = useRef(true)

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return

    needsCalibrationRef.current = true
    DeviceMotion.setUpdateInterval(TILT_UPDATE_INTERVAL_MS)
    const interfaceOrientation = trackInterfaceOrientation()

    const subscription = DeviceMotion.addListener((measurement) => {
      const { rotation: sensorRotation } = measurement
      if (!sensorRotation) return
      const { player, rotation, board, paddleY, onPaddleTargetY } = latestRef.current
      const orientation = interfaceOrientation.current(measurement.orientation)

      if (needsCalibrationRef.current || baselineRef.current?.orientation !== orientation) {
        baselineRef.current = calibrateTiltBaseline(sensorRotation.beta, sensorRotation.gamma, paddleY, orientation)
        needsCalibrationRef.current = false
        return
      }

      const y = computeTiltTargetY(sensorRotation.beta, sensorRotation.gamma, baselineRef.current, rotation, board.paddleMinY, board.paddleMaxY)
      onPaddleTargetY(player, y)
    })

    return () => {
      subscription.remove()
      interfaceOrientation.remove()
    }
  }, [enabled])

  const prevPhaseRef = useRef(phase)
  useEffect(() => {
    // Every fresh transition into 'live' - the initial serve (idle->live) AND every point's re-serve
    // (pointScored->live) - flags a recalibration, giving the player a natural moment to resettle
    // their grip between points, mirroring the game's own SERVE_PAUSE_MS pause rhythm.
    if (phase === 'live' && prevPhaseRef.current !== 'live') needsCalibrationRef.current = true
    prevPhaseRef.current = phase
  }, [phase])

  return null
}
