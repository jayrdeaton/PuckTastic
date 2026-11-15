/* global jest */
const RN = require('react-native')
const { useState } = require('react')
const passthrough = (value: unknown) => value
const passthroughLast = (...values: unknown[]) => values[values.length - 1]

// A shared value kept for the component's life, as Reanimated's is: useMotionReducer's drawing
// (src/shared/motion) queues every physics step into one with modify(). No frame callback ever runs
// here, so nothing is drawn; the live state the games read is plain JS.
function makeMutable<T>(initial: T) {
  const mutable = {
    value: initial,
    get: () => mutable.value,
    set: (next: T | ((value: T) => T)) => {
      mutable.value = typeof next === 'function' ? (next as (value: T) => T)(mutable.value) : next
    },
    modify: (modifier?: (value: T) => T) => {
      if (modifier) mutable.value = modifier(mutable.value)
    }
  }
  return mutable
}

const Animated = {
  View: RN.View,
  Text: RN.Text,
  Image: RN.Image,
  ScrollView: RN.ScrollView,
  FlatList: RN.FlatList,
  createAnimatedComponent: (Component: unknown) => Component,
  useSharedValue: <T>(value: T) => useState(() => makeMutable(value))[0],
  makeMutable,
  useFrameCallback: () => ({ setActive: () => undefined, isActive: false, callbackId: -1 }),
  useAnimatedStyle: (updater?: () => unknown) => (typeof updater === 'function' ? updater() : {}),
  useAnimatedProps: (updater?: () => unknown) => (typeof updater === 'function' ? updater() : {}),
  useAnimatedScrollHandler: (handler: (...args: unknown[]) => unknown) => handler,
  useDerivedValue: (updater?: () => unknown) => ({ value: typeof updater === 'function' ? updater() : undefined }),
  withTiming: passthrough,
  withSpring: passthrough,
  withDecay: passthrough,
  withDelay: (_ms: number, value: unknown) => value,
  withRepeat: (value: unknown) => value,
  withSequence: passthroughLast,
  cancelAnimation: jest.fn(),
  interpolate: passthrough,
  interpolateColor: () => '#000000',
  runOnUI: (fn: (...args: unknown[]) => unknown) => fn,
  useAnimatedRef: () => ({ current: null }),
  measure: () => ({ x: 0, y: 0, width: 0, height: 0, pageX: 0, pageY: 0 }),
  scrollTo: jest.fn(),
  Easing: {
    linear: passthrough,
    ease: passthrough,
    in: passthrough,
    out: passthrough,
    inOut: passthrough,
    bezier: () => passthrough
  },
  Extrapolation: {
    CLAMP: 'clamp',
    EXTEND: 'extend',
    IDENTITY: 'identity'
  },
  FadeIn: { duration: () => ({}) },
  FadeOut: { duration: () => ({}) },
  Layout: { duration: () => ({}) },
  default: {
    View: RN.View,
    Text: RN.Text,
    Image: RN.Image,
    ScrollView: RN.ScrollView,
    FlatList: RN.FlatList,
    createAnimatedComponent: (Component: unknown) => Component,
    call: jest.fn()
  }
}

module.exports = Animated
