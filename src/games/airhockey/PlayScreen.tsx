import { useAutoPaperTheme } from '@rific/auto-paper'
import { useKeepAwake } from '@rific/core'
import { Button, useVibration } from '@rific/feedback-press'
import { useToast } from '@rific/toaster'
import { broadcastDeviceUnlocks } from '@tastic/achievements'
import { rotateInsets, useBackgroundPause, useOrientationState } from '@tastic/core'
import { ConfirmDialog, MONO_FONT, overlayActionStyles, OverlayBackdrop, OverlayCard, useOverlayCardColors, useQuitConfirmation } from '@tastic/hud'
import { humanSeatsFor, liveplayActions, MatchChips, safeBack, SettingsDialog, useActiveRound, useAtComputer, useBackBlock, useProfiles } from '@tastic/shell'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch } from 'react-redux'
import type { Action, Dispatch } from 'redux'

import Board from '@/games/airhockey/components/BoardHost'
import KeyboardInputLayer from '@/games/airhockey/components/KeyboardInputLayer'
import TouchInputLayer from '@/games/airhockey/components/TouchInputLayer'
import { DESKTOP_WEB_MIN_WIDTH, FRICTION_LEVELS } from '@/games/airhockey/constants/game'
import { useAIOpponent } from '@/games/airhockey/hooks/useAIOpponent'
import { useGameState } from '@/games/airhockey/hooks/useGameState'
import { useGameStats } from '@/games/airhockey/hooks/useGameStats'
import { DEFAULT_SETTINGS } from '@/games/airhockey/redux/settingsSlice'
import { GameMode, GoalAxis, Player } from '@/games/airhockey/types'
import { computeBoardLayout, computeLocalContainerSize } from '@/games/airhockey/utils/board'
import { seatResultSpots } from '@/games/airhockey/utils/seatResultSpots'
import { matchHasProgress } from '@/shared/matchHasProgress'
import { SeatResultCards } from '@/shared/SeatResultCards'
import { SeatToasters } from '@/shared/SeatToasters'
import { useGameSound } from '@/shared/useGameSound'
import { SEAT_TOAST_STACKS, useUnlockToasts } from '@/shared/useUnlockToasts'

// Converts a point expressed in the board's own LOCAL coordinate space (the same frame board.x/y
// lives in) into a real, absolute screen position - mirrors Pong's own localToScreen exactly (see
// its doc comment there), needed here for the same reason: floating UI (the back/settings chips
// below) lives OUTSIDE the rotated local container, so anchoring it to "the board's own top-left
// corner" only lands in the right real screen spot if this applies the SAME rotationDeg the
// container itself was rotated by.
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

// Vs CPU has one human, seat 1.
const SEATS: readonly Player[] = [1, 2]
const SOLO_SEATS: readonly Player[] = [1]

export default function GameScreen() {
  // Committed once by the loadout when every human player readied up (see the shell's
  // liveplaySlice.ts and useActiveRound) - falls back to Air Hockey's defaults against the CPU for a
  // direct link to this screen, which never went through the loadout to commit anything. Lock
  // Orientation applies to this round at once: the shell's OrientationBridge feeds the pack-wide
  // setting to the shared orientation reading the board reads below.
  const { mode, settings: roundSettings } = useActiveRound('airhockey', DEFAULT_SETTINGS)
  const dispatch = useDispatch<Dispatch<Action>>()
  const { recordMatchOutcome } = useGameStats()
  const { profiles, lastSelected } = useProfiles()
  const { clear: clearToasts } = useToast()
  const showUnlockToasts = useUnlockToasts()
  const scoreToWin = roundSettings.scoreToWin
  const friction = FRICTION_LEVELS[roundSettings.friction]
  const puckSize = roundSettings.puckSize
  const paddleSize = roundSettings.paddleSize
  const rink = roundSettings.rink
  // Only P2 can be CPU-controlled - pass-and-play stays the default, single-player just swaps who
  // controls P2's paddle (see useAIOpponent, which drives it through the exact same setPaddleTarget
  // path a human's touch uses).
  const aiPlayer: Player | null = mode === 'vsCpu' ? 2 : null
  // Air Hockey's stats keep the mode as AirHockey recorded it.
  const gameMode: GameMode = mode === 'twoPlayer' ? 'twoPlayer' : 'vsCpu'
  const aiDifficulty = roundSettings.aiDifficulty
  const humanPlayers = humanSeatsFor(mode)

  // Unlike BoxHockey (always vertical), AirHockey's board adapts to the window's shape (see
  // GoalAxis's own doc comment in types/index.ts): vertical goals in a tall window (a phone, always
  // portrait, so 2 Player is face to face there, P1 at the bottom), horizontal ones in a wide window
  // (a landscape iPad, a browser window). Air Hockey sets the shell's sideBySideWhenWide, so the
  // loadout's 2 Player panels split the same way and each player keeps their half into the match.
  const { orientationMode } = useOrientationState()
  const goalAxis: GoalAxis = orientationMode === 'sideBySide' ? 'horizontal' : 'vertical'

  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // computeBoardLayout's own local space is ALWAYS canonically portrait-shaped (see GoalSide's doc
  // comment in types/index.ts) regardless of goalAxis - goalAxis only decides which real screen
  // dimension feeds its short-vs-long split, not the shape of what it hands back. So this ±90°
  // exists to visually turn that always-tall container into a landscape-looking one whenever
  // goalAxis is 'horizontal'. The turn is +90, which carries the rink's bottom (player 1's end) to
  // the left, where the loadout's side-by-side panels put player 1. It's purely the rink's own
  // layout: the window is already the right shape (the OS turns the interface), so everything
  // floating over the rink stays upright (see overlays below).
  const rotationDeg: 0 | 90 = goalAxis === 'horizontal' ? 90 : 0

  // computeBoardLayout reads the window's own visual shape (width > height in landscape).
  const logicalWidth = width
  const logicalHeight = height
  // rotateInsets always returns a fresh object, so this has to be memoized on insets/rotationDeg
  // itself - otherwise logicalInsets is a new reference every render, which busts the board
  // useMemo below on every render regardless of whether anything actually changed, which in turn
  // busts useGameState's own board-reference-equality check (its RESCALE effect, keyed on
  // `board !== prevBoard`) and fires an unbounded dispatch loop.
  const logicalInsets = useMemo(() => rotateInsets(insets, rotationDeg), [insets, rotationDeg])

  // board (canonical LOCAL geometry - see GoalSide's doc comment in types/index.ts) and localSize
  // (the container BEFORE the rotation below) are derived from the same S/L split, so they always
  // agree with each other regardless of goalAxis.
  const board = useMemo(() => computeBoardLayout(logicalWidth, logicalHeight, logicalInsets, goalAxis, puckSize, paddleSize, rink), [logicalWidth, logicalHeight, logicalInsets, goalAxis, puckSize, paddleSize, rink])
  const localSize = useMemo(() => computeLocalContainerSize(logicalWidth, logicalHeight, goalAxis), [logicalWidth, logicalHeight, goalAxis])
  // The local container is flex-centered within the full-screen viewport (see the `viewport` style
  // below), so its own screen-space center always coincides with the screen's center -
  // TouchInputLayer needs this (plus the rotation itself) to convert a touch's real screen
  // position back into local board coordinates by hand (see its own screenToLocal comment for
  // why this can't just rely on a zone's own e.x/e.y). Deliberately the RAW (physical, un-swapped)
  // width/height, unlike the board geometry above - a real touch always arrives in real physical
  // screen coordinates regardless of the CSS rotation trick, so this has to stay in that same
  // physical space for TouchInputLayer's own un-rotation math to line up with it.
  const screenCenterX = width / 2
  const screenCenterY = height / 2

  // Settings/quit-confirm dialogs pause gameplay while open. useQuitConfirmation reads hasProgress
  // lazily (only inside a real requestBack() call, via its own ref-mirrored getter - see that
  // hook's own doc) rather than taking a plain boolean, which is exactly what makes this safe to
  // call before `phase` and `scores` exist yet: they come from useGameState's returned state
  // (below), which itself needs `paused` (derived from confirmVisible) as an INPUT, so a
  // plain-boolean argument here would be a real circular render dependency. The closure below
  // reads whatever hasProgressRef holds, mirrored from `phase` and `scores` once they exist (below).
  const [settingsOpen, setSettingsOpen] = useState(false)
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

  const { state, live, onStep, drawn, setPaddleTarget, resetGame } = useGameState(board, scoreToWin, friction, paused)
  const { phase, scores, lastScoredGoal, bounceCount, goalDoorHitCount, lastGoalDoorSide, puckInPlay } = state
  // The keyboard's baseline: where the paddles are now, not at the last render (see KeyboardInputLayer).
  const livePaddles = useCallback(() => live().paddles, [live])
  // Mirrored for useQuitConfirmation's getter above, which can't read phase and scores directly:
  // react-hooks/immutability flags reading a binding before its own declaration, even in a closure
  // only ever invoked later. Effect-based, as vibrationRef/soundRef are, so requestBack reads the
  // most recently committed render's value.
  const hasProgress = matchHasProgress(phase, scores)
  useEffect(() => {
    hasProgressRef.current = hasProgress
  })
  // While Quit Match? would ask, Android's back and the browser's back open it too, not just the back
  // chip (audit F093; @tastic/shell's useBackBlock). quitMatch is Quit Match?'s and Paused's Quit: it
  // leaves past that block, where safeBack would be stopped by it.
  const quitMatch = useBackBlock(hasProgress, requestBack)

  // Mirrors "an actual live rally, not paused" into liveplay.activelyPlaying for Providers.tsx's
  // EdgeGuardBridge rather than calling useEdgeGestureGuard directly here: it stays mounted once for
  // the app's lifetime, and this is just the one signal it has no other way to read. Unlocked between points (idle/goalScored/gameOver) and whenever a
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

  // The rink's desktop shape (a fixed ratio with drawn walls, a browser window at least
  // DESKTOP_WEB_MIN_WIDTH wide): mirrors utils/board.ts's isDesktopLayout, so it's the window's width,
  // not whether this is a computer.
  const desktopBoard = Platform.OS === 'web' && width >= DESKTOP_WEB_MIN_WIDTH
  // A computer (the shell's useAtComputer: the web without a touch-first screen, at any width): its
  // two players sit side by side, so nothing of player 2's is turned to face the far end.
  const atComputer = useAtComputer()
  // 2 Player: each seat's half of the screen and the angle it reads at, for its Game Over card
  // (SeatResultCards) and its unlock toasts (SeatToasters) alike, so a player's toasts sit where
  // their card does, facing the same way.
  const seatSpots = seatResultSpots(rotationDeg, atComputer)

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

  const vibration = useVibration()
  const vibrationRef = useRef(vibration)
  useEffect(() => {
    vibrationRef.current = vibration
  })

  const playBounce = useGameSound(require('../../../assets/sounds/bounce.wav'))
  const playGoal = useGameSound(require('../../../assets/sounds/goal.wav'))
  const playWin = useGameSound(require('../../../assets/sounds/win.wav'))
  const soundRef = useRef({ playBounce, playGoal, playWin })
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
      const matchWinner: Player = scores[0] >= scoreToWin ? 1 : 2
      const profileIds = { 1: lastSelected[1] ?? undefined, 2: aiPlayer === null ? (lastSelected[2] ?? undefined) : undefined }
      const result = recordMatchOutcome({ winner: matchWinner, scores: [scores[0], scores[1]], goalDoorHits: goalDoorHitCount }, { gameMode, aiDifficulty, profileIds })
      if (aiPlayer === null) {
        // Genuine two-seat pass-and-play: each seat's unlocks are toasts on that seat's own stack,
        // in their half of the screen and turned to face them (SeatToasters, on seatSpots), so a
        // player at the opposite end of the table (the far side of a portrait/vertical-goalAxis
        // hold, same as real air hockey) reads their own the right way up, and players side by side
        // each read theirs on their own side. The winner's seat also gets the device-wide unlocks
        // that are really its own (all of them for a guest, only scope: 'device' ones for a profile;
        // see @tastic/achievements' broadcastDeviceUnlocks). The loser gets only its own (audit F037).
        const broadcast = broadcastDeviceUnlocks(SEATS, result.profiles, result.device, profileIds, { winners: [matchWinner] })
        showUnlockToasts(broadcast, SEATS, { 1: profiles.find((p) => p.id === profileIds[1])?.name, 2: profiles.find((p) => p.id === profileIds[2])?.name }, SEAT_TOAST_STACKS)
      } else {
        // vsCpu only ever has one human perspective (seat 1) to address - the shared, screen-fixed
        // toast is fine here.
        showUnlockToasts(broadcastDeviceUnlocks(SOLO_SEATS, result.profiles, result.device, profileIds), SOLO_SEATS, { 1: profiles.find((p) => p.id === profileIds[1])?.name })
      }
    }
    prevPhaseRef.current = phase
  }, [phase, scores, scoreToWin, aiPlayer, aiDifficulty, goalDoorHitCount, lastSelected, gameMode, recordMatchOutcome, profiles, showUnlockToasts])

  // ─── Floating UI placement ─────────────────────────────────────────────────
  // localToScreen's containerWidth/Height MUST be localSize.width/height (the pre-rotation
  // container's own S×L size, per computeLocalContainerSize's own doc): board.x/y live in that local
  // frame, and it's THAT view, sized to localSize and centered in the real viewport, that rotationDeg
  // rotates (using logicalWidth/Height here once sent the back chip off-screen on desktop web).
  // The back and settings chips are the shell's MatchChips (one rule for every game): 2 Player in a
  // tall window sits face to face, so they go to the side edges at the rink's center line, between
  // the players; anywhere else, the window's top corners. Hidden while the puck is live.
  const faceToFace = humanPlayers.length === 2 && rotationDeg === 0
  const centerLineY = localToScreen(board.x, board.y + board.height / 2, localSize.width, localSize.height, screenCenterX, screenCenterY, rotationDeg).y

  const progressMessage = (
    <>
      <Text style={{ color: playerColor[1] }}>{scores[0]}</Text>
      <Text style={{ color: fgMuted }}> - </Text>
      <Text style={{ color: playerColor[2] }}>{scores[1]}</Text>
    </>
  )
  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* Local-space board + input area - sized to localSize (the container BEFORE rotation,
          covering the whole screen so the rink pocket can reach into the safe-area insets; the
          board geometry keeps the playing field itself inside them), centered on the screen,
          then rotated ±90° for side-by-side
          landscape so the SAME canonical local geometry (see GoalSide's own doc comment) maps
          onto a wide screen correctly. Board's Skia canvas is written purely in local
          coordinates and never branches on goalAxis at all - DOM/native hit-testing correctly
          respects this rotation when deciding which zone a touch lands on, so TouchInputLayer's
          two zones don't need to branch on axis either. Only the touch's own COORDINATE VALUE
          needs explicit handling: TouchInputLayer converts e.absoluteX/Y back into local space
          itself (see its own screenToLocal comment for why - verified in the browser preview
          that react-native-gesture-handler's web e.x/e.y do NOT correctly invert an ancestor's
          CSS rotation the way native touch delivery would), which is why it needs
          screenCenterX/Y and rotationDeg passed in below, matching this same rotation exactly.
          Rotation direction confirmed empirically in the browser preview (a hand-derived
          clockwise/counter-clockwise expectation didn't match RN-web's actual rotate() sign, so
          this is calibrated against the real render, not re-derived from theory): '90deg' puts
          player 1 (local bottom) on the screen's RIGHT, '-90deg' puts them on the LEFT. */}
      <View style={[styles.viewport, { width, height }]}>
        <View style={[styles.localContainer, { width: localSize.width, height: localSize.height }, rotationDeg !== 0 && { transform: [{ rotate: `${rotationDeg}deg` }] }]}>
          <Board board={board} drawn={drawn} phase={phase} scores={scores} scoreToWin={scoreToWin} lastScoredGoal={lastScoredGoal} goalDoorHitCount={goalDoorHitCount} lastGoalDoorSide={lastGoalDoorSide} showWalls={desktopBoard} />
          {/* Zones themselves still live inside this same rotated container - DOM/native hit-
              testing needs their rotated screen footprint to correctly decide WHICH zone a touch
              landed on; only the resulting coordinate VALUE (screenToLocal, using
              screenCenterX/Y + rotationDeg below) needs the explicit, non-rotation-relative fix. */}
          <TouchInputLayer humanPlayers={humanPlayers} enabled={!paused} localWidth={localSize.width} localHeight={localSize.height} screenCenterX={screenCenterX} screenCenterY={screenCenterY} rotationDeg={rotationDeg} onPaddleTarget={setPaddleTarget} />
        </View>
      </View>

      {/* Web-only, additive keyboard input - see that component's own doc for why it needs no
      rotation-awareness the way TouchInputLayer does. It reads the paddles' live positions every
      frame (livePaddles), since a tick that only moves them doesn't render. */}
      <KeyboardInputLayer enabled={!paused} humanPlayers={humanPlayers} controlScheme={roundSettings.controlScheme} paddlePos={livePaddles} onPaddleTarget={setPaddleTarget} />

      {/* Game Over overlay - upright whatever the rink's turn.
          2 Player gets one card per seat instead, each in that player's half and turned to face
          them (SeatResultCards); this single card is Vs CPU's. */}
      {phase === 'gameOver' && aiPlayer === null && <SeatResultCards winner={winner} scores={scores} playerColor={playerColor} playerOnColor={playerOnColor} spots={seatSpots} onPlayAgain={() => resetGame(board)} onQuit={safeBack} />}

      {/* 2 Player's unlock toasts, a Toaster per seat in that seat's half, turned to face it (see
      the gameOver effect above); every other toast stays on the app's main Toaster (_layout.tsx). */}
      {aiPlayer === null && <SeatToasters spots={seatSpots} />}
      {phase === 'gameOver' && aiPlayer !== null && (
        <OverlayBackdrop style={styles.resultBackdrop}>
          <OverlayCard style={styles.resultCard}>
            <Icon source='trophy' size={64} color={playerColor[winner]} />
            <Text variant='headlineLarge' style={[styles.overlayTitle, { color: playerColor[winner], fontFamily: MONO_FONT }]}>
              Wins!
            </Text>
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
      )}

      {/* Quit confirmation - now the fleet-shared @tastic/hud ConfirmDialog rather than a hand-
      rolled overlay, always upright.
      Trades this dialog's previous secondary-accent Quit button and MONO_FONT styling for the
      shared component's primary accent and default font - an accepted trade-off. */}
      <ConfirmDialog visible={confirmVisible} title='Quit Match?' message={progressMessage} confirmLabel='Quit' cancelLabel='Cancel' icon='alert-circle-outline' destructive={false} onConfirm={quitMatch} onCancel={cancelBack} />
      {/* Shown when the app comes back from the background mid-match (see useBackgroundPause above):
      play stays frozen until Resume, so a match never restarts before the player is back and ready. */}
      <ConfirmDialog visible={backgroundPaused} title='Paused' message={progressMessage} confirmLabel='Resume' cancelLabel='Quit' icon='pause-circle-outline' destructive={false} onConfirm={resume} onCancel={quitMatch} />

      {/* Back + settings: the shell's MatchChips (see faceToFace above). Up until the puck is in play:
      through every faceoff, until a paddle first strikes the puck (puckInPlay), so there's time to
      back out or open Settings before play starts. */}
      <MatchChips playing={phase === 'live' && puckInPlay} faceToFace={faceToFace} centerLineY={centerLineY} onBack={requestBack} onSettings={() => setSettingsOpen(true)} />

      <SettingsDialog visible={settingsOpen} onDismiss={() => setSettingsOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  // Deliberately NOT position: 'absolute' - it needs to stay a normal flex child of `viewport`
  // so that parent's alignItems/justifyContent: 'center' actually centers it (an absolutely
  // positioned child ignores its parent's flex alignment entirely and defaults to pinning at
  // (0,0) instead, which is what silently put the whole board off-center before this was caught
  // in the browser preview).
  localContainer: {},
  overlayScore: {},
  overlayTitle: { fontWeight: 'bold' },
  // The single Game Over card, as ConfirmDialog's: room from the screen's edges, and the card's full
  // width allowance (OverlayCard's maxWidth, 360) so its action row has room to sit side by side.
  resultBackdrop: { paddingHorizontal: 24 },
  resultCard: { width: '100%' },
  root: { flex: 1 },
  viewport: { alignItems: 'center', justifyContent: 'center', left: 0, position: 'absolute', top: 0 }
})
