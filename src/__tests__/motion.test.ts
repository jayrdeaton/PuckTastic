import { advanceMotion, FRAME_MS, type Motion, MOTION_LAG_MS, MOTION_MAX_LAG_MS, motionLagMs, placeMotion, queueStep, restingMotion } from '@/shared/motion/motion'

// The drawing of a match's moving pieces (src/shared/motion): physics steps from the JS thread,
// played back on the UI thread. These play a puck sliding at an even speed with its steps landing on
// the UI thread the way a slower Android phone's JS thread delivers them, and check where it's drawn
// on every frame, the way DuelTastic's useRiderGlide test does for its riders.

// 10px a frame at 60Hz: a fast Box Hockey shot, an Air Hockey puck off a paddle.
const SPEED = 10 / FRAME_MS

// A seeded random, so a run is the same every time.
function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

interface Landing {
  // The UI frame it lands on: it's queued after that frame is drawn, as useMotionReducer's
  // modify() reaches the UI thread between frames.
  frame: number
  at: number
  ms: number
}

// Plays `landings` (oldest first) over `frames` UI frames of `frameMs`. Returns how far the puck
// moved on each frame, drawn the way useMotionReducer draws it and, for comparison, drawn at each
// step the moment it lands (how every game drew it before, a render per step), plus how far behind
// the latest step it was drawn, in ms of play.
function play(landings: Landing[], frames: number, frameMs: number) {
  let motion = restingMotion([0, 0])
  let naive = 0
  let latest = 0
  let i = 0
  const moved: number[] = []
  const naiveMoved: number[] = []
  const behindMs: number[] = []
  for (let f = 0; f < frames; f++) {
    const before = motion.at[0]
    motion = advanceMotion(motion, frameMs)
    moved.push(motion.at[0] - before)
    const naiveBefore = naive
    while (i < landings.length && landings[i].frame <= f) {
      motion = queueStep(motion, [landings[i].at, 0], landings[i].ms)
      naive = landings[i].at
      latest = landings[i].at
      i++
    }
    naiveMoved.push(naive - naiveBefore)
    behindMs.push((latest - motion.at[0]) / SPEED)
  }
  return { moved, naiveMoved, behindMs, motion }
}

// The JS loop stepping every frame on time, each step landing up to `maxDelayFrames` UI frames after
// the frame it's due on (never before the step ahead of it, so steps held back land together): the
// JS thread busy with React's work or a garbage collection.
function landLate(maxDelayFrames: number, frames: number, seed = 3): Landing[] {
  const random = seeded(seed)
  const landings: Landing[] = []
  let lastFrame = 0
  for (let f = 0; f < frames; f++) {
    lastFrame = Math.max(lastFrame, f + Math.floor(random() * (maxDelayFrames + 1)))
    landings.push({ frame: lastFrame, at: SPEED * FRAME_MS * (f + 1), ms: FRAME_MS })
  }
  return landings
}

// The JS loop's own frames coming late: each step is `k` frames after the one before (k up to
// `maxGapFrames`, at random) and carries that much play (useGameLoop's dt), landing on the next UI
// frame.
function stepLate(maxGapFrames: number, frames: number, seed = 5): Landing[] {
  const random = seeded(seed)
  const landings: Landing[] = []
  let f = 0
  let at = 0
  while (f < frames) {
    const gap = 1 + Math.floor(random() * maxGapFrames)
    f += gap
    at += SPEED * FRAME_MS * gap
    landings.push({ frame: f, at, ms: FRAME_MS * gap })
  }
  return landings
}

const settle = (frames: number[], frameMs: number) => frames.slice(Math.round(1500 / frameMs))

describe('drawing a puck from late steps', () => {
  describe.each([1, 2, 3])('steps landing up to %d frames late', (maxDelayFrames) => {
    const frames = Math.round(10000 / FRAME_MS)
    const { moved, naiveMoved, motion } = play(landLate(maxDelayFrames, frames), frames, FRAME_MS)
    const even = SPEED * FRAME_MS
    const settled = settle(moved, FRAME_MS)

    it('stood still and jumped when each step was drawn as it landed', () => {
      const naive = settle(naiveMoved, FRAME_MS)
      expect(naive.filter((d) => d === 0).length / naive.length).toBeGreaterThan(0.1)
      expect(Math.max(...naive)).toBeGreaterThanOrEqual(even * 2)
    })

    it('never stands still, and seldom slows', () => {
      // With a fixed MOTION_LAG_MS it dropped to half its speed on frames from 3 frames late.
      for (const d of settled) {
        expect(d).toBeGreaterThan(even * 0.85)
        expect(d).toBeLessThan(even * 1.15)
      }
      expect(settled.filter((d) => d < even * 0.9).length / settled.length).toBeLessThan(0.01)
    })

    it('stays further behind its steps to cover them, within MOTION_MAX_LAG_MS', () => {
      expect(motion.jitterMs).toBeGreaterThan(0)
      expect(motionLagMs(motion.jitterMs)).toBeLessThanOrEqual(MOTION_MAX_LAG_MS)
    })
  })

  describe.each([2, 3])('the JS loop’s own frames up to %d frames apart', (maxGapFrames) => {
    const frames = Math.round(10000 / FRAME_MS)
    const { moved, naiveMoved } = play(stepLate(maxGapFrames, frames), frames, FRAME_MS)
    const even = SPEED * FRAME_MS
    const settled = settle(moved, FRAME_MS)

    it('stood still and jumped when each step was drawn as it landed', () => {
      const naive = settle(naiveMoved, FRAME_MS)
      expect(naive.filter((d) => d === 0).length / naive.length).toBeGreaterThan(0.2)
    })

    it('never stands still, and seldom slows', () => {
      for (const d of settled) {
        expect(d).toBeGreaterThan(even * 0.85)
        expect(d).toBeLessThan(even * 1.15)
      }
      expect(settled.filter((d) => d < even * 0.9).length / settled.length).toBeLessThan(0.01)
    })
  })

  describe.each([1000 / 60, 1000 / 120])('steps on time, drawn on %dms frames', (frameMs) => {
    // 60Hz JS steps, drawn at 60Hz or 120Hz.
    const frames = Math.round(4000 / frameMs)
    const landings = landLate(0, Math.round(4000 / FRAME_MS)).map((l) => ({ ...l, frame: Math.round((l.frame * FRAME_MS) / frameMs) }))
    const { moved, behindMs, motion } = play(landings, frames, frameMs)
    const even = SPEED * frameMs

    it('moves the same distance every frame, within a few percent', () => {
      for (const d of settle(moved, frameMs).slice(0, -Math.round(200 / frameMs))) {
        expect(d).toBeGreaterThan(even * 0.95)
        expect(d).toBeLessThan(even * 1.05)
      }
    })

    it('stays about MOTION_LAG_MS behind its steps', () => {
      // Measured from the latest step, so up to a step further at the moment one lands.
      for (const ms of settle(behindMs, frameMs).slice(0, -Math.round(200 / frameMs))) {
        expect(ms).toBeGreaterThan(0)
        expect(ms).toBeLessThan(MOTION_LAG_MS + FRAME_MS + frameMs + 2)
      }
      expect(motionLagMs(motion.jitterMs)).toBe(MOTION_LAG_MS)
    })
  })
})

describe('advanceMotion', () => {
  const at = (x: number) => [x, 0]
  const steps = (motion: Motion, xs: number[], ms = FRAME_MS) => xs.reduce((m, x) => queueStep(m, at(x), ms), motion)
  const run = (motion: Motion, frames: number, frameMs = FRAME_MS) => {
    let m = motion
    for (let f = 0; f < frames; f++) m = advanceMotion(m, frameMs)
    return m
  }

  it('plays a slowing puck through its steps in order, never past the next', () => {
    // A puck under friction: each step shorter than the one before.
    const xs: number[] = []
    for (let x = 0, v = 12; v > 0.2; v *= 0.95) xs.push((x += v))
    let motion = restingMotion(at(0))
    let last = 0
    for (const x of xs) {
      motion = advanceMotion(queueStep(motion, at(x), FRAME_MS), FRAME_MS)
      expect(motion.at[0]).toBeGreaterThanOrEqual(last)
      expect(motion.at[0]).toBeLessThanOrEqual(x)
      last = motion.at[0]
    }
    // Then comes to rest on the last step and stays there.
    motion = run(motion, 60)
    expect(motion.at[0]).toBe(xs[xs.length - 1])
    expect(motion.steps).toHaveLength(0)
    const still = advanceMotion(motion, FRAME_MS)
    expect(still.at).toBe(motion.at)
  })

  it('moves every piece along the same steps together', () => {
    let motion = restingMotion([0, 0, 100, 100])
    motion = queueStep(motion, [10, 0, 100, 90], FRAME_MS)
    motion = queueStep(motion, [20, 0, 100, 80], FRAME_MS)
    motion = advanceMotion(motion, FRAME_MS / 2)
    // Played through the same share of the first step: the puck 10px to the right, the paddle 10px up.
    expect(motion.at[0] / 10).toBeCloseTo((100 - motion.at[3]) / 10)
  })

  it('jumps at once to a step that takes no time (a ball put back for the serve), once it gets there', () => {
    let motion = steps(restingMotion(at(0)), [10, 20, 30])
    motion = queueStep(motion, at(500), 0)
    motion = queueStep(motion, at(505), FRAME_MS)
    // Still on its way through the moving steps first.
    motion = advanceMotion(motion, FRAME_MS)
    expect(motion.at[0]).toBeLessThanOrEqual(30)
    motion = run(motion, 10)
    // Never drawn between the last moving step and the jump.
    expect(motion.at[0]).toBeGreaterThanOrEqual(500)
  })

  it('draws a placed piece at once, keeping how late its steps have landed', () => {
    let motion = steps(restingMotion(at(0)), [10, 20])
    motion = { ...motion, jitterMs: 30 }
    motion = placeMotion(motion, at(300))
    expect(motion.at).toEqual(at(300))
    expect(motion.steps).toHaveLength(0)
    expect(motion.jitterMs).toBe(30)
    // The first step after it isn't counted as late, however long it took.
    motion = queueStep(run(motion, 20), at(310), FRAME_MS)
    expect(motion.jitterMs).toBeLessThan(30)
  })

  it('doesn’t count a long wait as lateness (a Box Hockey puck at rest between turns)', () => {
    let motion = steps(restingMotion(at(0)), [10])
    motion = run(motion, 120)
    motion = queueStep(motion, at(20), FRAME_MS)
    expect(motion.jitterMs).toBe(0)
  })

  it('lets the lateness wear off once its steps land on time again', () => {
    let motion = steps(restingMotion(at(0)), [10])
    motion = advanceMotion(motion, FRAME_MS + 40)
    motion = queueStep(motion, at(20), FRAME_MS)
    expect(motion.jitterMs).toBeCloseTo(40)
    motion = run(motion, 360)
    expect(motion.jitterMs).toBeLessThan(10)
  })

  it('skips ahead after a stalled frame rather than racing to catch up', () => {
    // Twenty steps land during one long frame.
    let motion = steps(
      restingMotion(at(0)),
      Array.from({ length: 20 }, (_, i) => (i + 1) * 10)
    )
    motion = advanceMotion(motion, FRAME_MS)
    const behindMs = ((200 - motion.at[0]) / 10) * FRAME_MS
    expect(behindMs).toBeLessThanOrEqual(MOTION_LAG_MS + FRAME_MS + 1)
  })

  it('keeps no more than 64 steps when nothing draws them, played from the oldest kept', () => {
    const motion = steps(
      restingMotion(at(0)),
      Array.from({ length: 100 }, (_, i) => i + 1)
    )
    expect(motion.steps).toHaveLength(64)
    expect(motion.from).toEqual(at(36))
  })
})
