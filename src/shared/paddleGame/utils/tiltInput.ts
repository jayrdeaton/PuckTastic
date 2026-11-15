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

// How far the device's right edge dips below the horizon (radians, negative when it rises): what
// steering reads in place of gamma. Both platforms report gamma as an Euler roll, atan2(-up.x, up.z)
// for the up vector in the device's frame (Android's SensorManager.getOrientation, iOS's
// CMAttitude.roll), which only behaves while the screen faces the sky. A phone held upright to play
// has up.z near 0, so gamma swings tens of degrees on a hand's tremor, and once the phone tips past
// vertical it jumps by 180: a calibration caught there left every later reading 100 degrees or more
// away, pinning the paddle at one end however the phone was tilted (Jay's Android, 2026-11-15). The
// same up vector is (-sin(gamma) cos(beta), sin(beta), cos(gamma) cos(beta)) on both platforms
// (beta is the asin one), so -up.x, the sine of the right edge's dip, is sin(gamma) cos(beta): the
// 180 jump and the swing near vertical both cancel out of it, and it reads the same at any hold.
// Lying flat it's gamma exactly.
export function edgeDip(beta: number, gamma: number): number {
  return Math.asin(Math.max(-1, Math.min(1, Math.sin(gamma) * Math.cos(beta))))
}

// AXIS MAPPING, in two turns. First the tilt delta, in the device's own frame (the right edge's dip
// for its X axis, beta for its Y), is turned into the screen's axes by the interface orientation
// (@tastic/core's tiltToScreenAxes): the OS turns the interface on a tablet, so "toward the screen's
// right" isn't always the device's X axis. Then the court's own drawn turn picks the screen axis the
// paddle travels along, by symmetry with TouchInputLayer's screenToLocalY: an unturned court (a wide
// window) maps local Y onto screen Y, a court turned -90 (a tall window) maps local Y onto screen X,
// unnegated. On a phone (always portrait, court -90) that's the right edge's dip.
function travelDeltaDeg(deltaBetaDeg: number, deltaDipDeg: number, orientation: Orientation, courtRotation: 0 | -90): number {
  const screen = tiltToScreenAxes(deltaDipDeg, deltaBetaDeg, orientation)
  return courtRotation === -90 ? screen.x : screen.y
}

// beta/gamma: the CURRENT DeviceMotionMeasurement.rotation reading (radians - see RAD_TO_DEG's own
// doc above). paddleMinY/paddleMaxY: this player's travel range (BoardLayout's own fields).
// Internally clamped to that range - defense in depth mirroring utils/board.ts's own clampPaddleY,
// even though setPaddleTarget clamps again downstream.
export function computeTiltTargetY(beta: number, gamma: number, baseline: TiltBaseline, courtRotation: 0 | -90, paddleMinY: number, paddleMaxY: number): number {
  const deltaBetaDeg = (beta - baseline.beta) * RAD_TO_DEG
  const deltaDipDeg = (edgeDip(beta, gamma) - edgeDip(baseline.beta, baseline.gamma)) * RAD_TO_DEG
  const raw = travelDeltaDeg(deltaBetaDeg, deltaDipDeg, baseline.orientation, courtRotation)

  const magnitude = Math.abs(raw)
  const deadZoned = magnitude <= TILT_DEAD_ZONE_DEG ? 0 : Math.sign(raw) * (magnitude - TILT_DEAD_ZONE_DEG)

  const usableDeg = TILT_MAX_DEG - TILT_DEAD_ZONE_DEG
  const fraction = Math.max(-1, Math.min(1, deadZoned / usableDeg))

  const travelRadius = (paddleMaxY - paddleMinY) / 2
  const y = baseline.paddleY + fraction * travelRadius

  return Math.min(paddleMaxY, Math.max(paddleMinY, y))
}
