import { useCallback, useEffect, useRef, useState } from 'react'
import { type FrameInfo, type SharedValue, useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated'

import { advanceMotion, FRAME_MS, landStep, MOTION_MAX_FRAME_MS, MOTION_MAX_LAG_MS, motionLagMs, passTime, placeMotion, queueStep, restingMotion, restingTiming, samePositions, type StepTiming } from './motion'

export interface MotionReducerOptions<S> {
  // The positions drawn on the UI thread (see motion.ts), in the same order every time:
  // [x0, y0, x1, y1, ...].
  positions: (state: S) => number[]
  // Whether a step changed anything React draws: anything but the positions above, or something
  // the screen works out from them (Box Hockey's puck slowing enough to grab). A step that changes
  // only the positions doesn't render at all; they're drawn on the UI thread.
  renders: (prev: S, next: S) => boolean
  // Whether a step put the pieces somewhere new rather than moving them there (a ball placed for the
  // next serve), so the drawing jumps there once it gets to that step instead of gliding across.
  jumps?: (prev: S, next: S) => boolean
}

export interface MotionReducer<S, A> {
  // What React draws: the live state as of the last render.
  state: S
  // The live state, every step's change in it whether it rendered or not. Anything that acts on
  // where the pieces are now (a CPU player, a key held down) reads this, never `state`.
  live: () => S
  // Any action but a physics step: rendered at once, and anything it moved is placed, not glided.
  dispatch: (action: A) => void
  // A physics step of `dt` frames (useGameLoop's): its positions are queued for the UI thread, and
  // anything else it changed is rendered once the drawing gets to it.
  step: (action: A, dt: number) => void
  // Called after every step with the live state: a CPU player deciding where its paddle goes next.
  onStep: (listener: (state: S) => void) => () => void
  // Where the pieces are drawn now, on the UI thread (see useDrawnPoint).
  drawn: SharedValue<number[]>
}

// When to render what a step changed, kept on the JS thread: the drawing is about its lag behind the
// latest step (motion.ts), so a change (a goal, a broken brick, a bounce's sound) is rendered once
// that much more play has been stepped, rather than the moment it happened in play, when the puck
// is still drawn on its way there.
interface Pacing {
  timing: StepTiming
  lastStepAt: number | null
  // Play stepped so far, in ms, and the play times at which changes waiting to render are drawn.
  playMs: number
  due: number[]
}

// A change waits no longer than this to render, in case play stops stepping before the drawing gets
// to it (a pause).
const RENDER_FALLBACK_MS = MOTION_MAX_LAG_MS + 4 * FRAME_MS

// A game's state, moved on by a reducer, with its moving pieces drawn smoothly on the UI thread
// (Box Hockey, Air Hockey, Paddles and Breaker).
//
// They used to dispatch every physics step into React (useReducer), so the whole play screen and its
// board rendered 60 times a second on the JS thread. A slower Android phone's JS thread can't do that
// on time, so steps landed late and unevenly and the puck stuttered (Jay, 2026-11-15). Now the
// reducer runs here on a live state; a step that only moves things doesn't render, its positions go
// to the UI thread (motion.ts), and React renders only what changes now and then: the phase, a
// score, a bounce, a broken brick.
export function useMotionReducer<S, A>(reducer: (state: S, action: A) => S, init: () => S, options: MotionReducerOptions<S>): MotionReducer<S, A> {
  const [state, setState] = useState(init)
  const liveRef = useRef(state)
  const reducerRef = useRef(reducer)
  const optionsRef = useRef(options)
  useEffect(() => {
    reducerRef.current = reducer
    optionsRef.current = options
  })

  const [initialPositions] = useState(() => options.positions(state))
  const motion = useSharedValue(restingMotion(initialPositions))
  const drawn = useSharedValue(initialPositions)

  const pacingRef = useRef<Pacing>({ timing: restingTiming(), lastStepAt: null, playMs: 0, due: [] })
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listenersRef = useRef(new Set<(state: S) => void>())

  const clearFallback = useCallback(() => {
    if (fallbackRef.current === null) return
    clearTimeout(fallbackRef.current)
    fallbackRef.current = null
  }, [])

  // Renders the live state, and with it every change still waiting.
  const renderNow = useCallback(() => {
    pacingRef.current.due = []
    clearFallback()
    setState(liveRef.current)
  }, [clearFallback])

  useEffect(() => clearFallback, [clearFallback])

  const dispatch = useCallback(
    (action: A) => {
      const prev = liveRef.current
      const next = reducerRef.current(prev, action)
      if (next === prev) return
      liveRef.current = next
      const at = optionsRef.current.positions(next)
      if (!samePositions(at, optionsRef.current.positions(prev))) {
        pacingRef.current.timing = { ...pacingRef.current.timing, stepMs: 0 }
        motion.modify((m) => {
          'worklet'
          return placeMotion(m, at)
        })
      }
      renderNow()
    },
    [motion, renderNow]
  )

  const step = useCallback(
    (action: A, dt: number) => {
      const prev = liveRef.current
      const next = reducerRef.current(prev, action)
      liveRef.current = next
      const { positions, renders, jumps } = optionsRef.current
      const changed = next !== prev
      const ms = changed && jumps?.(prev, next) ? 0 : dt * FRAME_MS
      const at = positions(next)
      motion.modify((m) => {
        'worklet'
        return queueStep(m, at, ms)
      })

      const pacing = pacingRef.current
      const now = performance.now()
      pacing.timing = landStep(passTime(pacing.timing, pacing.lastStepAt === null ? 0 : now - pacing.lastStepAt), ms)
      pacing.lastStepAt = now
      pacing.playMs += dt * FRAME_MS
      if (changed && renders(prev, next)) {
        pacing.due.push(pacing.playMs + motionLagMs(pacing.timing.jitterMs))
        if (fallbackRef.current === null) fallbackRef.current = setTimeout(renderNow, RENDER_FALLBACK_MS)
      }
      if (pacing.due.length > 0 && pacing.due[0] <= pacing.playMs) {
        const waiting = pacing.due.filter((due) => due > pacing.playMs)
        if (waiting.length === 0) renderNow()
        else {
          pacing.due = waiting
          setState(liveRef.current)
        }
      }

      listenersRef.current.forEach((listener) => listener(next))
    },
    [motion, renderNow]
  )

  const live = useCallback(() => liveRef.current, [])

  const onStep = useCallback((listener: (state: S) => void) => {
    const listeners = listenersRef.current
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  // The same callback every render: useFrameCallback registers it again whenever it changes, and a
  // callback's first frame has no time since the one before.
  const onFrame = useCallback(
    (frame: FrameInfo) => {
      'worklet'
      const next = advanceMotion(motion.get(), Math.min(frame.timeSincePreviousFrame ?? 0, MOTION_MAX_FRAME_MS))
      motion.set(next)
      if (next.at !== drawn.get()) drawn.set(next.at)
    },
    [motion, drawn]
  )
  useFrameCallback(onFrame)

  return { state, live, dispatch, step, onStep, drawn }
}

// Whether anything in `next` but `keys` is a different value from `prev`'s: what a game's `renders`
// is mostly made of.
export function changedBesides<S extends object>(prev: S, next: S, keys: readonly (keyof S)[]): boolean {
  for (const key of Object.keys(next) as (keyof S)[]) {
    if (!keys.includes(key) && prev[key] !== next[key]) return true
  }
  return false
}

// A transform putting what's drawn at (0, 0) where the `index`th piece (a puck, a paddle) is drawn.
export function useDrawnPoint(drawn: SharedValue<number[]>, index: number) {
  return useDerivedValue(() => [{ translateX: drawn.value[index * 2] }, { translateY: drawn.value[index * 2 + 1] }])
}
