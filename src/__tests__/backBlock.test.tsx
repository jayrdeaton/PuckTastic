import { useQuitConfirmation } from '@tastic/hud'
import { safeBack, useBackBlock } from '@tastic/shell'
import { router } from 'expo-router'
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { useEffect, useRef, useState } from 'react'
import { BackHandler, Pressable, Text, View } from 'react-native'

import { matchHasProgress } from '@/shared/matchHasProgress'

// Audit F093: Android's back and the browser's back left a match at once, skipping the Quit Match? the
// back chip asks. Every play screen now holds the route with @tastic/shell's useBackBlock while Quit
// Match? would ask. This runs that wiring under expo-router's real in-memory router (the app's own
// expo-router mock stands in for it everywhere else), and scans the play screens for it.
jest.unmock('expo-router')

// Android's back, as the router's container hears it: React Native's BackHandler is a no-op off
// Android, so this keeps every listener and calls them the way the OS does (the newest first, until
// one handles it).
type BackListener = Parameters<typeof BackHandler.addEventListener>[1]
const backListeners: BackListener[] = []
jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
  backListeners.push(handler)
  return { remove: () => backListeners.splice(backListeners.indexOf(handler), 1) }
})
async function pressAndroidBack() {
  await act(async () => {
    for (const handler of [...backListeners].reverse()) if (handler({} as Parameters<BackListener>[0])) return
  })
}

// A hockey play screen's back wiring in miniature, as Box Hockey and Air Hockey have it: Quit Match?
// from hud's useQuitConfirmation (reading progress through a ref mirrored once the game's state
// exists), the block after the state, the back chip, Quit Match?'s and Paused's Quit, and buttons
// standing in for a goal and the match ending.
function PlayScreen() {
  const hasProgressRef = useRef(false)
  const { confirmVisible, requestBack, cancelBack } = useQuitConfirmation(() => hasProgressRef.current, safeBack)
  const [scores, setScores] = useState<[number, number]>([0, 0])
  const [phase, setPhase] = useState('live')
  const hasProgress = matchHasProgress(phase, scores)
  useEffect(() => {
    hasProgressRef.current = hasProgress
  })
  const quitMatch = useBackBlock(hasProgress, requestBack)
  return (
    <View>
      <Text>Match</Text>
      <Pressable accessibilityLabel='Goal' onPress={() => setScores(([a, b]) => [a + 1, b])} />
      <Pressable accessibilityLabel='Game Over' onPress={() => setPhase('gameOver')} />
      <Pressable accessibilityLabel='Back' onPress={requestBack} />
      {confirmVisible && (
        <View>
          <Text>Quit Match?</Text>
          <Pressable accessibilityLabel='Quit' onPress={quitMatch} />
          <Pressable accessibilityLabel='Cancel' onPress={cancelBack} />
        </View>
      )}
    </View>
  )
}

async function openMatch() {
  const rendered = await renderRouter({ index: () => <Text>Home</Text>, 'play/[game]': PlayScreen }, { initialUrl: '/' })
  await act(async () => router.push('/play/boxhockey'))
  expect(rendered.getPathname()).toBe('/play/boxhockey')
  return rendered
}

const press = (label: string) => fireEvent.press(screen.getByLabelText(label))

let warn: jest.SpyInstance
let error: jest.SpyInstance
beforeEach(() => {
  backListeners.length = 0
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  error = jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  // expo-router warns when a stopped navigation is carried on with the block still on.
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  warn.mockRestore()
  error.mockRestore()
})

describe('back during a match', () => {
  it("leaves at once at 0-0, with nothing to lose (Android's back)", async () => {
    const rendered = await openMatch()
    await pressAndroidBack()
    expect(rendered.getPathname()).toBe('/')
  })

  it("opens Quit Match? on Android's back once there's a goal, and stays in the match", async () => {
    const rendered = await openMatch()
    await press('Goal')
    await pressAndroidBack()
    expect(screen.getByText('Quit Match?')).toBeTruthy()
    expect(rendered.getPathname()).toBe('/play/boxhockey')
  })

  it("opens Quit Match? on the router's back, which the browser's back goes through", async () => {
    const rendered = await openMatch()
    await press('Goal')
    await act(async () => router.back())
    expect(screen.getByText('Quit Match?')).toBeTruthy()
    expect(rendered.getPathname()).toBe('/play/boxhockey')
  })

  it.each([
    ['the back chip', () => press('Back')],
    ["Android's back", pressAndroidBack]
  ])("still leaves on Quit Match?'s Quit, opened by %s", async (_name, open) => {
    const rendered = await openMatch()
    await press('Goal')
    await open()
    await press('Quit')
    expect(rendered.getPathname()).toBe('/')
    expect(screen.getByText('Home')).toBeTruthy()
  })

  it('stays on Cancel, and asks again on the next back', async () => {
    const rendered = await openMatch()
    await press('Goal')
    await pressAndroidBack()
    await press('Cancel')
    expect(screen.queryByText('Quit Match?')).toBeNull()
    await pressAndroidBack()
    expect(screen.getByText('Quit Match?')).toBeTruthy()
    expect(rendered.getPathname()).toBe('/play/boxhockey')
  })
})

describe('back at Game Over', () => {
  it.each([
    ["Android's back", pressAndroidBack],
    ["the router's back", () => act(async () => router.back())],
    ['the back chip', () => press('Back')]
  ])('leaves at once on %s', async (_name, back) => {
    const rendered = await openMatch()
    await press('Goal')
    await press('Game Over')
    await back()
    expect(screen.queryByText('Quit Match?')).toBeNull()
    expect(rendered.getPathname()).toBe('/')
  })
})

describe('matchHasProgress', () => {
  it('asks once there is a goal, and never at Game Over', () => {
    expect(matchHasProgress('live', [0, 0])).toBe(false)
    expect(matchHasProgress('live', [1, 0])).toBe(true)
    expect(matchHasProgress('idle', [0, 2])).toBe(true)
    expect(matchHasProgress('gameOver', [3, 1])).toBe(false)
  })
})

// Every play screen with a Quit Match? holds its route with useBackBlock, and its Quit Match?'s and
// Paused's Quit leave through the block's quit, never safeBack, which the block would stop.
const SRC = join(__dirname, '..')
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx$/.test(name) ? [path] : []
  })
}
const DIALOG = /<ConfirmDialog\b[^>]*\btitle='(Quit Match\?|Paused)'[^>]*\/>/g

describe('the play screens', () => {
  const screens = sourceFiles(SRC).filter((file) => readFileSync(file, 'utf8').includes("title='Quit Match?'"))

  it('are the three with a Quit Match?', () => {
    expect(screens.map((file) => relative(SRC, file)).sort()).toEqual([join('games', 'airhockey', 'PlayScreen.tsx'), join('games', 'boxhockey', 'PlayScreen.tsx'), join('shared', 'paddleGame', 'PlayScreen.tsx')])
  })

  it('each hold the route with useBackBlock', () => {
    for (const file of screens) expect(readFileSync(file, 'utf8')).toMatch(/= useBackBlock\(hasProgress, requestBack\)/)
  })

  it('never quit Quit Match? or Paused with safeBack', () => {
    const dialogs = screens.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(DIALOG)].map((match) => ({ file: relative(SRC, file), dialog: match[0] })))
    expect(dialogs).toHaveLength(6)
    expect(dialogs.filter(({ dialog }) => /safeBack/.test(dialog))).toEqual([])
  })
})
