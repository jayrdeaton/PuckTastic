// Where a match's moving pieces (a puck, a ball, the paddles) are drawn, played back on the UI thread
// from the physics steps the JS thread sends it.
//
// Each game steps its physics on the JS thread's animation frames (@tastic/core's useGameLoop). A
// slower Android phone's JS thread can't always step on time (a garbage collection, React's own
// work), so a step lands a frame or two late, and drawing each step the moment it landed moved the
// puck in uneven jumps. Here each step is queued with how long it took in play (its dt in ms), and
// a frame callback on the UI thread plays the queue back at an even pace a little behind the latest
// step, so a late step finds the drawing still on its way to the one before. It's the same model as
// DuelTastic's rider glide (`src/shared/match/useRiderGlide.ts`), there for grid steps; here the
// steps are played by time rather than by distance, since a puck slows down.
//
// Positions are flat: [x0, y0, x1, y1, ...], in a fixed order each game picks (see useMotionReducer).

// One nominal 60fps frame, in ms: a step's dt is in these (see @tastic/core's computeClampedDt).
export const FRAME_MS = 1000 / 60

// How far behind its latest step the drawing aims to be, in ms of play, at the least: a little more
// than a frame at 60Hz, so a step that lands a frame late (the JS thread's frames and the UI
// thread's don't line up) finds the drawing still on its way.
export const MOTION_LAG_MS = 24

// The most the drawing stays behind. Steps land later than a frame when the JS thread is busy, so
// the drawing measures how late its steps land (Motion.jitterMs) and stays that much further behind,
// up to this, rather than reaching its last step and standing there until the next one lands. An
// iPhone's steps land within a frame, so it stays at MOTION_LAG_MS.
export const MOTION_MAX_LAG_MS = 80

// Added to the lateness measured, so a step landing as late as the latest late one still finds the
// drawing moving.
const MOTION_JITTER_MARGIN_MS = 8

// A step later than this isn't counted as lateness: play stopped on purpose (a puck at rest in Box
// Hockey, a pause), or the JS thread stalled for longer than any lag would cover.
const MOTION_MAX_JITTER_SAMPLE_MS = 120

// How quickly the lateness measured wears off once steps land on time again, so one slow moment (a
// garbage collection) doesn't hold the drawing further back for the rest of the match.
const MOTION_JITTER_HALF_LIFE_MS = 3000

// How much further behind than its lag the drawing may fall (a stalled UI frame, a burst of steps
// after one) before it skips ahead to its lag behind, rather than racing to catch up.
const MOTION_MAX_BEHIND_MS = 100

// How quickly the drawing's pace corrects toward its lag behind the steps: this many ms off changes
// its pace by its whole speed. Slow enough that steps landing a frame early or late change it by a
// few percent at most.
const MOTION_CORRECTION_MS = 400
const MIN_PACE = 0.5
const MAX_PACE = 2.5

// The longest UI frame counted: the first frame after a pause or the app coming back plays no more
// than this.
export const MOTION_MAX_FRAME_MS = 100

// The most steps queued. Only reached when the UI thread stops drawing while the JS thread keeps
// stepping (a test, a hidden browser tab that still steps); the oldest are dropped.
const MAX_QUEUED_STEPS = 64

// A physics step: the positions it left everything at, and how long it took in play.
export interface MotionStep {
  at: number[]
  ms: number
}

// How late the steps are landing, kept by whoever receives them: the UI thread for its drawing, the
// JS thread for when to show what changed with them (see useMotionReducer).
export interface StepTiming {
  // How long the latest step took in play, and how long ago it landed.
  stepMs: number
  sinceStep: number
  // How late steps have landed lately, in ms past the time the step before took in play, wearing
  // off over MOTION_JITTER_HALF_LIFE_MS.
  jitterMs: number
}

// Where everything is drawn and the steps it's still on its way through, kept on the UI thread.
export interface Motion extends StepTiming {
  at: number[]
  // Where the first queued step is played from, and how far into it the drawing is, in ms.
  from: number[]
  into: number
  steps: MotionStep[]
}

export function restingTiming(): StepTiming {
  'worklet'
  return { stepMs: 0, sinceStep: 0, jitterMs: 0 }
}

// Everything standing at `at`, going nowhere.
export function restingMotion(at: number[]): Motion {
  'worklet'
  return { ...restingTiming(), at, from: at, into: 0, steps: [] }
}

// How far behind its latest step the drawing aims to be: MOTION_LAG_MS, or more while steps have
// been landing late.
export function motionLagMs(jitterMs: number): number {
  'worklet'
  return Math.min(MOTION_MAX_LAG_MS, Math.max(MOTION_LAG_MS, jitterMs + MOTION_JITTER_MARGIN_MS))
}

// `dt` ms passing.
export function passTime<T extends StepTiming>(timing: T, dt: number): T {
  'worklet'
  return { ...timing, sinceStep: timing.sinceStep + dt, jitterMs: timing.jitterMs * Math.pow(0.5, dt / MOTION_JITTER_HALF_LIFE_MS) }
}

// A step of `ms` landing. One landing later than the step before took in play is counted toward the
// lateness (jitterMs); one after a long wait (play stopped, a stall) or after everything was placed
// (stepMs 0) isn't.
export function landStep<T extends StepTiming>(timing: T, ms: number): T {
  'worklet'
  const lateMs = timing.sinceStep - timing.stepMs
  const counts = timing.stepMs > 0 && lateMs > 0 && lateMs <= MOTION_MAX_JITTER_SAMPLE_MS
  return { ...timing, stepMs: ms, sinceStep: 0, jitterMs: counts ? Math.max(timing.jitterMs, lateMs) : timing.jitterMs }
}

// The drawing with a step queued after the ones it's still on its way through.
export function queueStep(motion: Motion, at: number[], ms: number): Motion {
  'worklet'
  let steps = motion.steps.concat([{ at, ms }])
  let { from, into } = motion
  if (steps.length > MAX_QUEUED_STEPS) {
    from = steps[steps.length - MAX_QUEUED_STEPS - 1].at
    steps = steps.slice(steps.length - MAX_QUEUED_STEPS)
    into = 0
  }
  return { ...landStep(motion, ms), steps, from, into }
}

// Everything drawn at `at` at once, going nowhere (a puck placed for a serve, a new round, a resize).
// Keeps how late steps have been landing; the next step isn't counted as late.
export function placeMotion(motion: Motion, at: number[]): Motion {
  'worklet'
  return { ...restingMotion(at), jitterMs: motion.jitterMs }
}

// The drawing `dt` ms on. It plays its steps at their own pace, corrected a little toward its lag
// (motionLagMs) behind the latest step, so everything moves as it did in play however unevenly its
// steps land. Once the queue runs out it stands at the last step until the next lands. A drawing more
// than MOTION_MAX_BEHIND_MS further behind skips ahead. `at` keeps its identity while nothing moves.
export function advanceMotion(motion: Motion, dt: number): Motion {
  'worklet'
  const timed = passTime(motion, dt)
  if (motion.steps.length === 0) return timed

  // Play left to the latest step, and how far that is from where the drawing aims to be, both as
  // of the start of the frame: the drawing plays this frame's ms below.
  let left = -motion.into
  for (const step of motion.steps) left += step.ms
  const behind = left - (motionLagMs(motion.jitterMs) + Math.max(0, motion.stepMs - motion.sinceStep))
  const skipMs = behind > MOTION_MAX_BEHIND_MS ? behind : 0
  const pace = skipMs > 0 ? 1 : Math.min(MAX_PACE, Math.max(MIN_PACE, 1 + behind / MOTION_CORRECTION_MS))
  let play = skipMs + pace * dt

  const steps = motion.steps.slice()
  let { from, into } = motion
  while (steps.length > 0 && into + play >= steps[0].ms) {
    play -= steps[0].ms - into
    from = steps[0].at
    into = 0
    steps.shift()
  }
  if (steps.length === 0) return { ...timed, at: from, from, into: 0, steps }
  into += play
  const next = steps[0]
  const t = into / next.ms
  return { ...timed, at: from.map((v, i) => v + (next.at[i] - v) * t), from, into, steps }
}

// Whether two position lists are the same.
export function samePositions(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
