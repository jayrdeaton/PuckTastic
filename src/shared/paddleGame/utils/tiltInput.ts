import { tiltToScreenAxes } from '@tastic/core/interface-orientation'
import type { Orientation } from 'expo-screen-orientation'

import { TILT_DEAD_ZONE_DEG, TILT_MAX_DEG } from '@/shared/paddleGame/constants/game'

// expo-sensors' DeviceMotionMeasurement.rotation carries no unit annotation in its own type (unlike
// rotationRate, which is explicitly documented as degrees/s) - confirmed directly against the
// native source that beta/gamma are RADIANS on both platforms: iOS's DeviceMotionModule.swift
// passes CMAttitude.pitch/.roll straight through with no conversion (its own rotationRate sibling
// explicitly calls radiansToDegrees, rotation does not), and Android's DeviceMotionModule.kt feeds
// SensorManager.getOrientation()'s raw radian output through unconverted the same way. Converted to
// degrees here (not at the sensor-read call site) so TILT_DEAD_ZONE_DEG/TILT_MAX_DEG and this
// module's own tests can stay in the more intuitive unit.
const RAD_TO_DEG = 180 / Math.PI

// Captured once per calibration point (every fresh 'live' entry, i.e. every serve, plus resuming
// from a paused settings dialog, plus any turn of the interface mid-round - see TiltInputLayer's own
// doc for why). beta/gamma are stored RAW (radians, as read from the sensor) - only ever used as a
// subtraction baseline, so there's no reason to convert them until a delta is actually computed.
// paddleY is the paddle's CURRENT position at the moment of calibration, not board center - a
// calibrate-then-steer-by-delta scheme has to start exactly where the paddle already is, or
// calibrating would visibly snap it to center on every single serve. orientation is the interface
// orientation the deltas are turned into screen axes by (see computeTiltTargetY).
export interface TiltBaseline {
  beta: number
  gamma: number
  paddleY: number
  orientation: Orientation
}

export function calibrateTiltBaseline(beta: number, gamma: number, paddleY: number, orientation: Orientation): TiltBaseline {
  return { beta, gamma, paddleY, orientation }
}

// AXIS MAPPING, in two turns. First the tilt delta, in the device's own frame, is turned into the
// screen's axes by the interface orientation (@tastic/core's tiltToScreenAxes): the OS turns the
// interface on a tablet, so "toward the screen's right" isn't always the device's gamma. Then the
// court's own drawn turn picks the screen axis the paddle travels along, by symmetry with
// TouchInputLayer's screenToLocalY: an unturned court (a wide window) maps local Y onto screen Y, a
// court turned -90 (a tall window) maps local Y onto screen X, unnegated. On a phone (always portrait,
// court -90) that's exactly the gamma the steering always read.
function travelDeltaDeg(deltaBetaDeg: number, deltaGammaDeg: number, orientation: Orientation, courtRotation: 0 | -90): number {
  const screen = tiltToScreenAxes(deltaGammaDeg, deltaBetaDeg, orientation)
  return courtRotation === -90 ? screen.x : screen.y
}

// beta/gamma: the CURRENT DeviceMotionMeasurement.rotation reading (radians - see RAD_TO_DEG's own
// doc above). paddleMinY/paddleMaxY: this player's travel range (BoardLayout's own fields).
// Internally clamped to that range - defense in depth mirroring utils/board.ts's own clampPaddleY,
// even though setPaddleTarget clamps again downstream.
export function computeTiltTargetY(beta: number, gamma: number, baseline: TiltBaseline, courtRotation: 0 | -90, paddleMinY: number, paddleMaxY: number): number {
  const deltaBetaDeg = (beta - baseline.beta) * RAD_TO_DEG
  const deltaGammaDeg = (gamma - baseline.gamma) * RAD_TO_DEG
  const raw = travelDeltaDeg(deltaBetaDeg, deltaGammaDeg, baseline.orientation, courtRotation)

  const magnitude = Math.abs(raw)
  const deadZoned = magnitude <= TILT_DEAD_ZONE_DEG ? 0 : Math.sign(raw) * (magnitude - TILT_DEAD_ZONE_DEG)

  const usableDeg = TILT_MAX_DEG - TILT_DEAD_ZONE_DEG
  const fraction = Math.max(-1, Math.min(1, deadZoned / usableDeg))

  const travelRadius = (paddleMaxY - paddleMinY) / 2
  const y = baseline.paddleY + fraction * travelRadius

  return Math.min(paddleMaxY, Math.max(paddleMinY, y))
}
