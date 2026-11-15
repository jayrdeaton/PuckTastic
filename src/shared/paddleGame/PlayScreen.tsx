import { useAutoPaperTheme } from '@rific/auto-paper'
import { useKeepAwake } from '@rific/core'
import { Button, useVibration } from '@rific/feedback-press'
import { useToast } from '@rific/toaster'
import { broadcastDeviceUnlocks } from '@tastic/achievements'
import { rotateInsets, useBackgroundPause, useOrientationState } from '@tastic/core'
import { ConfirmDialog, MONO_FONT, overlayActionStyles, OverlayBackdrop, OverlayCard, useOverlayCardColors, useQuitConfirmation } from '@tastic/hud'
import { ProfileChip } from '@tastic/profile'
import { humanSeatsFor, liveplayActions, MatchChips, safeBack, SettingsDialog, useActiveRound, useAtComputer, useBackBlock, useProfiles } from '@tastic/shell'
import { needsSharedNeutralZone } from '@tastic/split-screen'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch } from 'react-redux'
import type { Action, Dispatch } from 'redux'

import { keepOnScreen } from '@/shared/keepOnScreen'
import Board from '@/shared/paddleGame/components/BoardHost'
import KeyboardInputLayer from '@/shared/paddleGame/components/KeyboardInputLayer'
import TiltInputLayer from '@/shared/paddleGame/components/TiltInputLayer'
import TouchInputLayer from '@/shared/paddleGame/components/TouchInputLayer'
import { DESKTOP_WEB_MIN_WIDTH, SOLO_LIVES } from '@/shared/paddleGame/constants/game'
import { useAIOpponent } from '@/shared/paddleGame/hooks/useAIOpponent'
import { useGameState } from '@/shared/paddleGame/hooks/useGameState'
import type { PaddleGameRecorders } from '@/shared/paddleGame/stats'
import { Player, Settings } from '@/shared/paddleGame/types'
import { computeBoardLayout } from '@/shared/paddleGame/utils/board'
import { tiltControlActiveFor } from '@/shared/paddleGame/utils/gameMode'
import { seatResultSpots } from '@/shared/paddleGame/utils/seatResultSpots'
import { SeatResultCards } from '@/shared/SeatResultCards'
import { SeatToasters } from '@/shared/SeatToasters'
import { useGameSound } from '@/shared/useGameSound'
import { SEAT_TOAST_STACKS, useUnlockToasts } from '@/shared/useUnlockToasts'

// Converts a point expressed in the board's own LOCAL coordinate space (the same frame board.x/y/
// paddleX live in) into a real, absolute screen position - the exact inverse of TouchInputLayer's
// own screenToLocalY, generalized to both axes since floating UI (score labels, corner buttons)
// needs a full 2D screen position, not just a Y. Used to anchor floating UI to a point ON the board
// (e.g. "near board's own top-left corner") so it lands in the correct real screen location
// regardless of live rotation, mirroring how BoxHockey's MatchOverlays rotates its dialog card in
// place rather than reflowing layout.
function localToScreen(localX: number, localY: number, containerWidth: number, containerHeight: number, screenCenterX: number, screenCenterY: number, rotation: 0 | 90 | -90): { x: number; y: number } {
  const lx = localX - containerWidth / 2
  const ly = localY - containerHeight / 2
  let dx: number
  let dy: number
  if (rotation === 90) {
    dx = -ly
    dy = lx
  } else if (rotation === -90) {
    dx = ly
    dy = -lx
  } else {
    dx = lx
    dy = ly
  }
  return { x: screenCenterX + dx, y: screenCenterY + dy }
}

const SEATS: readonly Player[] = [1, 2]

// The floating score labels' box (a headlineMedium digit or two, centered), halved, for placing
// them by their centers.
// A score's box on screen (it's drawn upright, so these are screen width and height whatever the court's
// turn), sized for its small digits (titleMedium in the mono font) and no bigger, so the box tucks in
// between the side wall and Breaker's shared bricks (SHARED_BRICK_FIELD_Y_MARGIN_RATIO, 8% of the
// court's width from each wall, about 27pt on a phone).
const SCORE_HALF_WIDTH = 14
const SCORE_HALF_HEIGHT = 12
// Each score sits against the side wall, right beside the center line on its own player's side: this
// far from the wall, and this far from the line.
const SCORE_WALL_GAP = 4
const SCORE_NET_GAP = 4
// Faded in its player's color, so it reads as part of the court, as Box Hockey's score wedges do,
// rather than a label on top of it.
const SCORE_OPACITY = 0.55
// Vs CPU and Solo have one human, seat 1.
const SOLO_SEATS: readonly Player[] = [1]

interface PaddlePlayScreenProps extends PaddleGameRecorders {
  // The game's id, to read back the round its loadout committed (see useActiveRound).
  game: string
  // The game's default settings, for a play screen reached without a committed round.
  defaults: Settings
  // Whether every round has a brick field between the paddles (Breaker) or none (Paddles). A solo
  // round always has one.
  hasBricks: boolean
}

// The paddle games' play screen (Paddles and Breaker, from Pong): each game's own PlayScreen hands
// it the game's id, defaults, bricks and stats recorders.
export function PaddlePlayScreen({ game, defaults, hasBricks, recordMatchOutcome, recordSoloOutcome }: PaddlePlayScreenProps) {
  // Committed once by the loadout when every human player readied up (see the shell's
  // liveplaySlice.ts and useActiveRound) - falls back to the game's defaults against the CPU for a
  // direct link to this screen, which never went through the loadout to commit anything.
  const { mode: gameMode, settings: roundSettings } = useActiveRound(game, defaults)
  const dispatch = useDispatch<Dispatch<Action>>()
  const { clear: clearToasts } = useToast()
  const showUnlockToasts = useUnlockToasts()
  const scoreToWin = roundSettings.scoreToWin
  const paddleSize = roundSettings.paddleSize
  const ballSpeed = roundSettings.ballSpeed
  const isSolo = gameMode === 'solo'
  // Only P2 can be CPU-controlled - pass-and-play stays the default, single-player just swaps who
  // controls P2's paddle (see useAIOpponent, which drives it through the exact same setPaddleTarget
  // path a human's touch uses). null for solo too - there's no seat 2 to control at all.
  const aiPlayer: Player | null = gameMode === 'vsCpu' ? 2 : null
  const aiDifficulty = roundSettings.aiDifficulty
  const humanPlayers = humanSeatsFor(gameMode)
  const tiltControlActive = tiltControlActiveFor(gameMode, roundSettings.tiltControlEnabled)

  // ─── Orientation / rotation ────────────────────────────────────────────────
  // The court is LANDSCAPE-native in local space (paddle separation along local X, the long axis -
  // see BoardLayout's own doc comment in types/index.ts), so it follows the window's shape: unturned
  // in a wide window (a landscape iPad, a browser window), where 2 Player sits side by side, P1 on
  // the left (Paddles and Breaker set the shell's sideBySideWhenWide, so the loadout splits the same
  // way); turned -90 in a tall one (a phone, always portrait), which puts P1 at the bottom, face to
  // face with P2 at the top in 2 Player. That's the opposite polarity from AirHockey's portrait-native
  // rink, which turns in the wide window instead. Nothing reads the device's hold, so tilt steering
  // can't turn the court either (see TiltInputLayer for how steering follows the interface).
  const { orientationMode } = useOrientationState()
  const rotation: 0 | -90 = orientationMode === 'sideBySide' ? 0 : -90

  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // Remaps insets onto the correct visual edge for the board's own rotated container - see
  // rotateInsets' own doc comment in @tastic/core. Applied wherever this screen's floating
  // UI needs to reason about the board's own (possibly rotated) edges, via computeBoardLayout below
  // (board.x/y/width/height end up correctly inset once, not the real screen's raw insets).
  const rotatedInsets = useMemo(() => rotateInsets(insets, rotation), [insets, rotation])

  // Pre-rotation container dimensions: real width/height directly for sideBySide (no swap - local
  // space maps straight onto the screen), SWAPPED for faceToFace (sizes the local rect correctly for
  // the container that's about to be rotated 90°/-90° to display it) - see computeBoardLayout's own
  // NOTE on the orientation layer in utils/board.ts.
  const containerWidth = rotation === 0 ? width : height
  const containerHeight = rotation === 0 ? height : width

  // The court's desktop shape (a fixed ratio with drawn walls, a browser window at least
  // DESKTOP_WEB_MIN_WIDTH wide): the window's width, not whether this is a computer, and not the
  // turned court's length.
  const desktopBoard = Platform.OS === 'web' && width >= DESKTOP_WEB_MIN_WIDTH
  const board = useMemo(() => computeBoardLayout(containerWidth, containerHeight, rotatedInsets, paddleSize, desktopBoard), [containerWidth, containerHeight, rotatedInsets, paddleSize, desktopBoard])

  // Settings/quit-confirm dialogs pause gameplay while open.
  const [settingsOpen, setSettingsOpen] = useState(false)
  // useQuitConfirmation reads hasProgress lazily (only inside a real requestBack() call, via its
  // own ref-mirrored getter - see that hook's own doc) rather than taking a plain boolean, which is
  // exactly what makes this safe to call before `state` exists yet: `state` (lives/bricks/scores)
  // comes from useGameState, which itself needs `paused` (derived from confirmVisible) as an INPUT,
  // so a plain-boolean argument computed from `state` here would be a real circular render
  // dependency. hasProgressRef breaks the remaining direct textual reference to lives/bricks/scores
  // (react-hooks/immutability flags reading a binding before its own declaration, even one only
  // ever invoked later - see the mirroring effect right after `state` is destructured below) -
  // it's reassigned every render via the same effect-based "ref mirrors latest value" idiom this
  // file already uses for vibrationRef/soundRef, so requestBack always reads the progress of the
  // most recently committed render, same as before.
  // scores stays [0,0] the whole round in solo (see useGameState's TICK case) - a lost life or a
  // broken brick is solo's own equivalent of "there's progress worth confirming before losing it".
  const hasProgressRef = useRef(false)
  const { confirmVisible, requestBack, cancelBack } = useQuitConfirmation(() => hasProgressRef.current, safeBack)
  // Leaving the app mid-match (home, app switch, a phone call, Control Center) latches a pause that
  // only the Paused dialog's Resume clears - see @tastic/core's useBackgroundPause. Skipped once the
  // match is over, or while a dialog already holds the pause by itself.
  const { backgroundPaused, resume } = useBackgroundPause(() => phase !== 'gameOver' && !settingsOpen && !confirmVisible)
  // Keeps the screen from dimming and locking while a match is up, unless Keep Awake is off in
  // Settings (read live, so the toggle applies mid-match). Expo only does this by itself in
  // development builds, and the OS auto-lock only counts screen touches, so tilt or keyboard
  // steering, or watching the CPU, could let a release build lock mid-match. The setting and the
  // expo-keep-awake module are @rific/core's, from Providers.tsx's KeepAwakeBridge.
  useKeepAwake('game')
  const paused = settingsOpen || confirmVisible || backgroundPaused

  // A computer (the shell's useAtComputer: the web without a touch-first screen, at any width): its
  // two players sit side by side, so nothing of player 2's is turned to face the far end, and they
  // play on the keyboard or mouse, so the serve doesn't wait for touch.
  const atComputer = useAtComputer()
  // Each human player's finger down in their zone (TouchInputLayer). On a touch screen the serve, the
  // opening one and each after a point, waits until every human player is touching (Jay,
  // 2026-11-07): the back and settings chips stay up until it goes (they only hide while the ball is
  // live), so there's time to back out, and no ball is served at nobody. Not at a computer, nor with
  // tilt steering, where nobody touches the screen to play.
  const [touching, setTouching] = useState<Record<Player, boolean>>({ 1: false, 2: false })
  const handleTouchingChange = useCallback((player: Player, isTouching: boolean) => setTouching((current) => (current[player] === isTouching ? current : { ...current, [player]: isTouching })), [])
  const serveHeld = !atComputer && !tiltControlActive && humanPlayers.some((player) => !touching[player])
  const { state, live, onStep, drawn, setPaddleTarget, resetGame } = useGameState(board, scoreToWin, ballSpeed, gameMode, hasBricks, paused, serveHeld)
  // The keyboard's baseline and tilt's calibration: where a paddle is now, not at the last render
  // (see KeyboardInputLayer).
  const livePaddleY = useCallback((player: Player) => live().paddles[player].y, [live])
  const { phase, scores, bounceCount, bricks, lives } = state

  // The real hasProgress check, now that lives/bricks/scores actually exist to read. Once the match is
  // over (gameOver) its stats are already recorded and nothing is lost, so back exits at once, the
  // same as the Game Over card's own buttons.
  const hasProgress = phase !== 'gameOver' && (isSolo ? lives < SOLO_LIVES || bricks.some((b) => b.destroyed) : scores[0] > 0 || scores[1] > 0)
  // See hasProgressRef's own comment above - mirrors hasProgress into it every render.
  useEffect(() => {
    hasProgressRef.current = hasProgress
  })
  // While Quit Match? would ask, Android's back and the browser's back open it too, not just the back
  // chip (audit F093; @tastic/shell's useBackBlock). quitMatch is Quit Match?'s and Paused's Quit: it
  // leaves past that block, where safeBack would be stopped by it.
  const quitMatch = useBackBlock(hasProgress, requestBack)

  // Mirrors "an actual live rally, not paused" into liveplay.activelyPlaying for Providers.tsx's
  // EdgeGuardBridge rather than calling useEdgeGestureGuard directly here: it stays mounted once for
  // the app's lifetime, and this is just the one signal it has no other way to read. Unlocked between points (idle/pointScored/gameOver) and whenever a
  // dialog is open (paused) - back/settings stay unconditionally visible here (unlike Snake/
  // LightCycles), so there's no button-visibility signal to key off instead. Reset to false on
  // unmount too, so leaving this screen mid-rally by any path can't leave Edge Guard stuck on.
  useEffect(() => {
    dispatch(liveplayActions.setActivelyPlaying(phase === 'live' && !paused))
    return () => {
      dispatch(liveplayActions.setActivelyPlaying(false))
    }
  }, [phase, paused, dispatch])

  // No toast may stay on screen during live play - only between rounds or at game over. Unlock
  // toasts fire at game over and last 7s, so a quick restart would otherwise carry them into the
  // next rally.
  useEffect(() => {
    if (phase === 'live') clearToasts()
  }, [phase, clearToasts])

  useAIOpponent(state, board, aiPlayer, aiDifficulty, paused, setPaddleTarget, onStep)

  // 2 Player: each seat's half of the screen and the angle it reads at, for its Game Over card
  // (SeatResultCards) and its unlock toasts (SeatToasters) alike, so a player's toasts sit where
  // their card does, facing the same way.
  const seatSpots = seatResultSpots(rotation, atComputer)

  const { dark, colors: themeColors } = useAutoPaperTheme()
  const bg = dark ? '#000000' : '#FFFFFF'
  // The Game Over card and the dialogs' score lines sit on @tastic/hud's OverlayCard, so their text
  // takes its theme colors rather than this screen's literal black/white.
  // Quit's outlined label is cardFg, the card's own text color, not Paper's default (the theme's
  // primary), so neither seat's card shows another seat's color (Jay, 2026-10-20).
  const { fg: cardFg, fgMuted } = useOverlayCardColors()

  const playerColor: Record<Player, string> = { 1: themeColors.primary, 2: themeColors.secondary }
  const playerOnColor: Record<Player, string> = { 1: themeColors.onPrimary, 2: themeColors.onSecondary }
  const winner: Player = scores[0] >= scoreToWin ? 1 : 2
  const loser: Player = winner === 1 ? 2 : 1

  // Neither AirHockey nor BoxHockey renders a bare ProfileChip directly - both only ever consume it
  // indirectly through ProfilePicker/ProfilesManager - so this is the one spot in the whole family
  // that reads useProfiles() just to look a profile up by id, not to drive a picker of its own.
  // Falls back to the plain 'P1'/'P2' label (same idle text ProfilePicker's own guestLabel would
  // show) whenever the winning seat never had a profile selected for this round.
  const { profiles, lastSelected } = useProfiles()
  const winnerProfile = profiles.find((p) => p.id === lastSelected[winner]) ?? null

  const vibration = useVibration()
  const vibrationRef = useRef(vibration)
  // Mirrored every render so the stable effects below can read the latest vibration handle without
  // needing it in their own deps - done inside an effect (no dependency array, so it reruns after
  // every render) rather than as a bare assignment in the component body, matching AirHockey's own
  // identical vibrationRef in its game.tsx: a bare `.current =` write during render is a render-time
  // side effect the react-hooks/refs rule (rightly) flags, since React may render this component
  // more than once for a single commit (e.g. under StrictMode or a Suspense retry) without any of
  // those extra renders actually reaching the browser/device - an effect only fires once per real commit.
  useEffect(() => {
    vibrationRef.current = vibration
  })

  // Gameplay SFX - mirrors the haptics above one-for-one: each event fires its soundRef.current.
  // playX() beside the matching vibrationRef.current.x(). Ref-mirrored the same way vibration is
  // above, not called directly, so the effects below don't need these in their dependency arrays.
  const playBounce = useGameSound(require('../../../assets/sounds/bounce.wav'))
  const playGoal = useGameSound(require('../../../assets/sounds/goal.wav'))
  const playWin = useGameSound(require('../../../assets/sounds/win.wav'))
  const soundRef = useRef({ playBounce, playGoal, playWin })
  // See vibrationRef's own comment above for why this is an effect rather than a bare render-time assignment.
  useEffect(() => {
    soundRef.current = { playBounce, playGoal, playWin }
  })

  const firstBounceRender = useRef(true)
  useEffect(() => {
    if (firstBounceRender.current) {
      firstBounceRender.current = false
      return
    }
    vibrationRef.current.short()
    soundRef.current.playBounce()
  }, [bounceCount])

  const prevScoresRef = useRef(scores)
  useEffect(() => {
    const [prevP1, prevP2] = prevScoresRef.current
    prevScoresRef.current = scores
    if (scores[0] !== prevP1 || scores[1] !== prevP2) {
      vibrationRef.current.notification()
      soundRef.current.playGoal()
    }
  }, [scores])

  const prevPhaseRef = useRef(phase)
  useEffect(() => {
    if (prevPhaseRef.current !== 'gameOver' && phase === 'gameOver') {
      soundRef.current.playWin()
      // Recorded on the transition rather than in the reducer, which runs every physics step and
      // has no notion of "this is new". prevPhaseRef guards a re-run from any other dep changing.
      if (isSolo) {
        // Solo has no opponent/score-tuple shape to fit into MatchOutcome - a genuinely separate
        // recording path (see recordSoloOutcome), not a solo-shaped MatchOutcome. lives > 0 at
        // gameOver means every brick was cleared (see useGameState's TICK case); lives <= 0 means
        // the player ran out.
        const result = recordSoloOutcome({ cleared: lives > 0, bricksDestroyed: bricks.filter((b) => b.destroyed).length }, lastSelected[1] ?? undefined)
        showUnlockToasts(broadcastDeviceUnlocks(SOLO_SEATS, result.profiles, result.device, { 1: lastSelected[1] ?? undefined }), SOLO_SEATS, { 1: profiles.find((p) => p.id === lastSelected[1])?.name })
      } else {
        const matchWinner: Player = scores[0] >= scoreToWin ? 1 : 2
        const profileIds = { 1: lastSelected[1] ?? undefined, 2: aiPlayer === null ? (lastSelected[2] ?? undefined) : undefined }
        // bricksDestroyed is 0 whenever the Bricks toggle was off for this round - correctly a
        // no-op add to the shared counter, not something that needs its own on/off branch here.
        const result = recordMatchOutcome({ winner: matchWinner, scores: [scores[0], scores[1]] }, { gameMode, aiDifficulty, ballSpeed, profileIds, bricksDestroyed: bricks.filter((b) => b.destroyed).length })
        if (aiPlayer === null) {
          // Genuine two-seat pass-and-play: each seat's unlocks are toasts on that seat's own stack,
          // in their half of the screen and turned to face them (SeatToasters, on seatSpots), so a
          // player seated opposite (the other end of a faceToFace hold) reads their own the right way
          // up, and players side by side each read theirs on their own side. The winner's seat also
          // gets the device-wide unlocks that are really its own (all of them for a guest, only
          // scope: 'device' ones for a profile; see @tastic/achievements' broadcastDeviceUnlocks).
          // The loser gets only its own (audit F037).
          const broadcast = broadcastDeviceUnlocks(SEATS, result.profiles, result.device, profileIds, { winners: [matchWinner] })
          showUnlockToasts(broadcast, SEATS, { 1: profiles.find((p) => p.id === profileIds[1])?.name, 2: profiles.find((p) => p.id === profileIds[2])?.name }, SEAT_TOAST_STACKS)
        } else {
          // vsCpu only ever has one human perspective (seat 1) to address - see the rotation
          // comment above for why this mode never enters a genuine faceToFace two-seat hold in
          // the first place - so the shared, screen-fixed toast is fine here.
          showUnlockToasts(broadcastDeviceUnlocks(SOLO_SEATS, result.profiles, result.device, profileIds), SOLO_SEATS, { 1: profiles.find((p) => p.id === profileIds[1])?.name })
        }
      }
    }
    prevPhaseRef.current = phase
  }, [phase, scores, scoreToWin, aiPlayer, aiDifficulty, ballSpeed, lastSelected, gameMode, recordMatchOutcome, isSolo, lives, bricks, recordSoloOutcome, profiles, showUnlockToasts])

  // ─── Floating UI placement ─────────────────────────────────────────────────
  // The score labels live OUTSIDE the board's own rotated container
  // (they're floating UI, not part of the playing field) and are individually positioned via
  // localToScreen, near the court's top corners, then kept on screen (keepOnScreen: on an iPad
  // the court reaches the window's edge). They never turn with the court: the window is read upright,
  // by the player at P1's end of a tall window too, so only player 2's own score turns, 180, to face
  // them across a face-to-face court.
  const screenCenterX = width / 2
  const screenCenterY = height / 2

  // Anchored to the board's OWN rect (board.x/y/width/height, not the raw container) so placement
  // automatically respects both the rotated safe-area insets AND any desktop-web letterboxing. Each
  // score sits small and faded against the court's top wall (local), right beside the center line on
  // its own player's side (Jay, 2026-11-07: by the center line, subtle, as Box Hockey's wedges are; at
  // the end wall, in line with the paddle, the paddle slid over it). The court's length runs along
  // local x, so on a turned court (a tall window) a score's offset from the line is its screen height
  // and its offset from the wall its screen width; side by side, the other way round.
  const turned = rotation !== 0
  const scoreHalfAlong = turned ? SCORE_HALF_HEIGHT : SCORE_HALF_WIDTH
  const scoreHalfAcross = turned ? SCORE_HALF_WIDTH : SCORE_HALF_HEIGHT
  const netX = board.x + board.width / 2
  const scoreY = board.y + SCORE_WALL_GAP + scoreHalfAcross
  const p1ScorePos = keepOnScreen(localToScreen(netX - SCORE_NET_GAP - scoreHalfAlong, scoreY, containerWidth, containerHeight, screenCenterX, screenCenterY, rotation), SCORE_HALF_WIDTH, SCORE_HALF_HEIGHT, { width, height }, insets)
  const p2ScorePos = keepOnScreen(localToScreen(netX + SCORE_NET_GAP + scoreHalfAlong, scoreY, containerWidth, containerHeight, screenCenterX, screenCenterY, rotation), SCORE_HALF_WIDTH, SCORE_HALF_HEIGHT, { width, height }, insets)
  // Player 2 sits at the OPPOSITE end of a face-to-face court (2 Player in a tall window, see the
  // rotation comment above), so their own label turns 180 to read upright from their seat. Anywhere
  // else (vs CPU, solo, side by side, at a computer) both labels are read from the same side.
  const p2ScoreStyle = rotation === -90 && humanPlayers.length === 2 && !atComputer ? styles.turnedAround : undefined

  // The court's own turn, for its container below only: nothing floating over it turns with it.
  const courtRotationStyle = rotation !== 0 ? { transform: [{ rotate: `${rotation}deg` }] } : undefined
  // The back and settings chips are the shell's MatchChips (one rule for every game): 2 Player face
  // to face (see @tastic/split-screen's needsSharedNeutralZone) puts them on the side edges at the
  // court's middle, between the players; anywhere else, the window's top corners. Hidden while the
  // puck is live.
  const faceToFace = needsSharedNeutralZone(orientationMode, humanPlayers.length)

  const progressMessage = isSolo ? (
    <Text style={{ color: fgMuted }}>
      {lives} {lives === 1 ? 'life' : 'lives'} · {bricks.filter((b) => b.destroyed).length} / {bricks.length} bricks
    </Text>
  ) : (
    <>
      <Text style={{ color: playerColor[1] }}>{scores[0]}</Text>
      <Text style={{ color: fgMuted }}> - </Text>
      <Text style={{ color: playerColor[2] }}>{scores[1]}</Text>
    </>
  )
  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* Board's own rotated container - see the rotation comment above for why, unlike
          BoxHockey/AirHockey's portrait-native board, Pong's landscape-native board genuinely needs
          to visually rotate for a face-to-face portrait hold. Sized to containerWidth/containerHeight
          (the pre-swap dimensions - since a 90°/-90° rotation swaps which screen dimension is "width"
          vs "height" for this box's own layout, it has to be laid out BEFORE the transform using
          whichever pairing was fed into computeBoardLayout above) and centered on the real screen
          exactly the way @tastic/core's own FakeLandscapeView centers its rotated content. */}
      <View
        style={[
          styles.localContainer,
          {
            width: containerWidth,
            height: containerHeight,
            left: (width - containerWidth) / 2,
            top: (height - containerHeight) / 2
          },
          courtRotationStyle
        ]}
      >
        <Board board={board} drawn={drawn} phase={phase} showWalls={desktopBoard} bricks={bricks} soloMode={isSolo} />
      </View>

      {/* Touch input - deliberately a SIBLING of the board's own rotated container, not nested
          inside it: react-native-gesture-handler does not correct a Pan gesture's own coordinate
          reporting for an ancestor View's CSS rotation, so keeping its root entirely outside that
          rotated ancestor sidesteps the whole class of issue rather than fighting it. Its own zones
          still cover the full real screen and invert each touch by hand (see its own file for why the
          split axis itself has to vary with rotation, not just the coordinate math). Disabled outside
          live play (paused, or the match has ended) same as AirHockey's own gestureEnabled gate. */}
      <TouchInputLayer humanPlayers={humanPlayers} enabled={!paused && phase !== 'gameOver'} containerHeight={containerHeight} rotation={rotation} onPaddleTargetY={setPaddleTarget} onTouchingChange={handleTouchingChange} />

      {/* Web-only, additive keyboard input - see that component's own doc for why it needs no
      rotation-awareness the way TouchInputLayer does. It reads the paddles' live Ys every frame
      (livePaddleY), since a tick that only moves them doesn't render. */}
      <KeyboardInputLayer enabled={!paused && phase !== 'gameOver'} humanPlayers={humanPlayers} controlScheme={roundSettings.controlScheme} paddleY={livePaddleY} onPaddleTargetY={setPaddleTarget} />

      {/* Additive on top of TouchInputLayer's own always-on drag input, same precedent as
      KeyboardInputLayer above - see that component's own doc for why this never disables touch.
      Always mounted (inert whenever `enabled` is false), same convention as the other two layers. */}
      <TiltInputLayer player={humanPlayers[0]} enabled={tiltControlActive && !paused && phase !== 'gameOver'} phase={phase} rotation={rotation} board={board} paddleY={livePaddleY} onPaddleTargetY={setPaddleTarget} />

      {/* Score labels - plain react-native-paper Text, not on the Skia canvas, small and faded
          against the side wall beside the center line, each on its own player's side (see
          p1ScorePos above), upright (player 2's turned to face them across a face-to-face court,
          see p2ScoreStyle above). None in Breaker's solo round: with no opponent the scores never
          move (its lives and bricks are on the Paused and Quit cards). */}
      {!isSolo && (
        <>
          <View pointerEvents='none' style={[styles.floatingChip, styles.scoreSlot, { left: p1ScorePos.x - SCORE_HALF_WIDTH, top: p1ScorePos.y - SCORE_HALF_HEIGHT }]}>
            <Text variant='titleMedium' style={{ color: playerColor[1], fontFamily: MONO_FONT, opacity: SCORE_OPACITY }}>
              {scores[0]}
            </Text>
          </View>
          <View pointerEvents='none' style={[styles.floatingChip, styles.scoreSlot, { left: p2ScorePos.x - SCORE_HALF_WIDTH, top: p2ScorePos.y - SCORE_HALF_HEIGHT }, p2ScoreStyle]}>
            <Text variant='titleMedium' style={{ color: playerColor[2], fontFamily: MONO_FONT, opacity: SCORE_OPACITY }}>
              {scores[1]}
            </Text>
          </View>
        </>
      )}

      {/* Back + settings: the shell's MatchChips (see faceToFace above). */}
      <MatchChips playing={phase === 'live'} faceToFace={faceToFace} onBack={requestBack} onSettings={() => setSettingsOpen(true)} />

      {/* Game Over overlay - solo has no opponent, so it gets its own branch entirely: lives > 0
          means every brick was cleared (a win), lives <= 0 means the player ran out (see
          useGameState's TICK case) - there's no "loser" to speak of, so Play Again just uses
          playerColor[1] rather than the loser's color the Vs CPU card below uses. Both cards put Quit
          (outlined) and Play Again side by side on hud's action row, as ConfirmDialog does.
          2 Player gets one card per seat, each in that player's half and turned to face them
          (SeatResultCards); Vs CPU keeps the single card. */}
      {phase === 'gameOver' &&
        (isSolo ? (
          <OverlayBackdrop style={styles.resultBackdrop}>
            <OverlayCard style={styles.resultCard}>
              <Icon source={lives > 0 ? 'trophy' : 'heart-broken'} size={64} color={playerColor[1]} />
              <Text variant='headlineLarge' style={[styles.overlayTitle, { color: playerColor[1], fontFamily: MONO_FONT }]}>
                {lives > 0 ? 'Cleared!' : 'Out of Lives'}
              </Text>
              <Text variant='bodyLarge' style={[styles.overlayScore, { color: fgMuted, fontFamily: MONO_FONT }]}>
                {bricks.filter((b) => b.destroyed).length} / {bricks.length} bricks
              </Text>
              {/* hud's action row, as in ConfirmDialog: Quit (outlined) on the left, Play Again (filled) on the right, side by side (Jay, 2026-10-20). */}
              <View style={overlayActionStyles.actions}>
                <Button mode='outlined' onPress={safeBack} style={overlayActionStyles.actionButton} textColor={cardFg}>
                  Quit
                </Button>
                <Button mode='contained' onPress={() => resetGame(board)} style={overlayActionStyles.actionButton} buttonColor={playerColor[1]} textColor={playerOnColor[1]}>
                  Play Again
                </Button>
              </View>
            </OverlayCard>
          </OverlayBackdrop>
        ) : aiPlayer === null ? (
          <SeatResultCards winner={winner} scores={scores} playerColor={playerColor} playerOnColor={playerOnColor} spots={seatSpots} onPlayAgain={() => resetGame(board)} onQuit={safeBack} />
        ) : (
          <OverlayBackdrop style={styles.resultBackdrop}>
            <OverlayCard style={styles.resultCard}>
              <Icon source='trophy' size={64} color={playerColor[winner]} />
              <Text variant='headlineLarge' style={[styles.overlayTitle, { color: playerColor[winner], fontFamily: MONO_FONT }]}>
                Wins!
              </Text>
              {winnerProfile ? (
                <View style={styles.winnerRow}>
                  <ProfileChip profile={winnerProfile} />
                  <Text variant='titleMedium' style={{ color: playerColor[winner], fontFamily: MONO_FONT }}>
                    {winnerProfile.name}
                  </Text>
                </View>
              ) : (
                <Text variant='titleMedium' style={{ color: playerColor[winner], fontFamily: MONO_FONT }}>
                  {winner === 1 ? 'P1' : 'P2'}
                </Text>
              )}
              <Text variant='bodyLarge' style={[styles.overlayScore, { fontFamily: MONO_FONT }]}>
                <Text style={{ color: playerColor[1] }}>{scores[0]}</Text>
                <Text style={{ color: fgMuted }}> - </Text>
                <Text style={{ color: playerColor[2] }}>{scores[1]}</Text>
              </Text>
              {/* hud's action row, as in ConfirmDialog: Quit (outlined) on the left, Play Again (filled) on the right, side by side (Jay, 2026-10-20). */}
              <View style={overlayActionStyles.actions}>
                <Button mode='outlined' onPress={safeBack} style={overlayActionStyles.actionButton} textColor={cardFg}>
                  Quit
                </Button>
                <Button mode='contained' onPress={() => resetGame(board)} style={overlayActionStyles.actionButton} buttonColor={playerColor[loser]} textColor={playerOnColor[loser]}>
                  Play Again
                </Button>
              </View>
            </OverlayCard>
          </OverlayBackdrop>
        ))}

      {/* 2 Player's unlock toasts, a Toaster per seat in that seat's half, turned to face it (see
      the gameOver effect above); every other toast stays on the app's main Toaster (_layout.tsx). */}
      {!isSolo && aiPlayer === null && <SeatToasters spots={seatSpots} />}

      {/* Quit confirmation - shared @tastic/hud dialog; accepts its primary accent + default font
          in place of this dialog's previous secondary-accent Quit button and MONO_FONT styling
          (a deliberate trade-off for convergence onto the shared component). Upright, like every
          dialog since the OS turns the interface: never handed the court's own quarter turn (it was
          until 2026-11-07, so in a tall window Quit Match? and Paused lay on their side). */}
      <ConfirmDialog visible={confirmVisible} title='Quit Match?' message={progressMessage} confirmLabel='Quit' cancelLabel='Cancel' icon='alert-circle-outline' destructive={false} onConfirm={quitMatch} onCancel={cancelBack} />
      {/* Shown when the app comes back from the background mid-match (see useBackgroundPause above):
      play stays frozen until Resume, so a match never restarts before the player is back and ready. */}
      <ConfirmDialog visible={backgroundPaused} title='Paused' message={progressMessage} confirmLabel='Resume' cancelLabel='Quit' icon='pause-circle-outline' destructive={false} onConfirm={resume} onCancel={quitMatch} />

      {/* Upright: since @tastic/shell 0.5 the Settings dialog takes no turn of its own. */}
      <SettingsDialog visible={settingsOpen} onDismiss={() => setSettingsOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  floatingChip: { position: 'absolute' },
  localContainer: { position: 'absolute' },
  overlayScore: {},
  overlayTitle: { fontWeight: 'bold' },
  // The single Game Over card, as ConfirmDialog's: room from the screen's edges, and the card's full
  // width allowance (OverlayCard's maxWidth, 360) so its action row has room to sit side by side.
  resultBackdrop: { paddingHorizontal: 24 },
  resultCard: { width: '100%' },
  root: { flex: 1 },
  scoreSlot: { alignItems: 'center', height: SCORE_HALF_HEIGHT * 2, justifyContent: 'center', width: SCORE_HALF_WIDTH * 2 },
  // Player 2's score in a face-to-face court, read from across the table.
  turnedAround: { transform: [{ rotate: '180deg' }] },
  // Marginless - sits between the "Wins!" title and the score line, both of which already carry
  // this card's own vertical gap (OverlayCard's own `gap`), so this row needs no extra spacing
  // of its own to read as one more line in that same stack.
  winnerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  }
})
