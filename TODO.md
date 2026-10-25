# TODO

Open fixes from the 2026-10-15 review of the 2026-10-08 fleet audit. Line numbers are as of that date. The F042, F094 and F010 fixes and `@tastic/profile` 0.12.0 landed on 2026-10-15, and F037 (device-wide unlocks on the winner's card only) with `@tastic/achievements` 0.6.0.

## Before launch

Nothing open: back after the match (F094) was checked live on web 2026-10-16 (see CLAUDE.md).

## After launch

1. **Android hardware back and web browser back skip "Quit Match?"** (audit F093). Needs hud support (an opt-in `BackHandler` in `useQuitConfirmation`, plus a router-level block for web). Before an Android release; iOS is unaffected.
2. **The Update Available prompt and toasts stay portrait while the screen is turned** (audit F007). The UpdateDialog wrapper passes no `rotation`, and the Toaster sits outside any turned frame. Pass `rotation`, or mount both in hud's `RotatedFrame`.
3. **Home's hero animation keeps looping under `/loadout` and `/game`** (audit F016). Pause it on blur and in the background, as Solitaire's HeroCards does (`useIsFocused` plus AppState).

## Expo SDK 58 follow-ups (2026-10-16)

Deferred to ship SDK 58 the same day:

- **Check it on a device.** Verify, typecheck and an iOS prebuild pass, but nothing ran on hardware: launch (SDK 58's scene life cycle), swiping a toast away (`@rific/toaster` 0.8.1 only had its gesture-handler 3 peer range raised, and its tests mock gesture-handler), the board's aim arrows and chevrons (moved to Skia 2.14's `PathBuilder`), and the edge-gesture guard.
- **React Native 0.88 strict types.** `@infinitetoken/tsconfig` 0.6 resolves React Native 0.88's legacy types, and React Native drops them after 0.88. This app's own code is already clean under the strict types (checked 2026-10-16 with `customConditions: ["react-native"]` only); the errors it sees are all in package source it type-checks (`@tastic/hud` 15, `@tastic/split-screen` 6, `@rific/auto-paper` 3, `@tastic/profile` 3, `@tastic/core` 1, `@rific/updater` 1). Fix those packages first (their TODO.md files), then drop the deferral.
- **Web tab title in the static HTML.** Since SDK 58, `expo-router/head`'s `<Head>` (in `src/components/Fonts.tsx`) only sets the title after hydration; the static export's HTML has none, so the tab shows the URL until the JS loads and crawlers see no title. Export `generateMetadata()` (returns `{ title }`) from each route, or from the root layout if Expo Router supports it there, then drop `<Head>`.

## Later: drop the BoxHockey 1.0 import (not before May 2027)

PuckTastic 2.0 copies a BoxHockey 1.0 save into its own store on its first launch (`src/importBoxHockey1.ts`; CLAUDE.md, "Pack structure" > "Saved data"). It only matters for a device that hasn't opened a 2.x build yet, so it can go once almost nobody is still on 1.0: **no earlier than six months after 2.0 is on the App Store, and not before May 2027.** Before deleting, check App Store Connect (App Analytics or Sales and Trends, by app version) that 1.x is down to nothing. Anyone still on 1.0 afterwards just starts fresh.

To remove it:
1. Delete `src/importBoxHockey1.ts`.
2. In `src/pack.ts`, drop the `migrate:` line and the `AsyncStorage` and `createBoxHockey1Import` imports.
3. In `src/__tests__/store.test.ts`, delete the "a BoxHockey 1.0 save" tests.
4. In CLAUDE.md's "Saved data", replace the import paragraph with a line saying 1.0 saves are no longer read (and when it was removed).
5. Run `npm run verify`.

## Game ideas (2026-10-24)

Just ideas, nothing decided. Suggested order: Curling, Soccer, the Mölkky remake, with Foosball as its own bigger project.

**First: puck-on-puck collisions.** Every game today has one puck (Breaker's only hits bricks), so nothing handles two moving pucks hitting each other. Curling, Soccer and the Mölkky remake all need it, so build it once, in shared code, with the first of them. Curling is the lightest case (a few stones, gentle bumps), Soccer the heaviest (7 bodies).

- **Curling.** Already on ice, so a puck sliding to the house is curling with a different stone. Reuses Box Hockey's flick, turn-taking and "wait until everything stops". New: the house (closest to the button scores), the stones knocking each other, and a long, predictable glide (its own friction, not Box Hockey's). Sweeping could be a later variant, giving the waiting player something to do. Picked over Shuffleboard, which is the same game on a table.
- **Soccer (button football).** A remake of a game Jay used to like: each side has 3 discs and there's one puck. Turn based but fast: flick one of your discs into the puck so it banks toward the goal. Needs choosing which disc to flick (tap one, or start the flick on it). The pack notes' "Soccer may come later" could be this.
- **Mölkky remake.** Pucks as the numbered pins and the thrown piece. Hit exactly 50 to win, go over and drop back to 25. Pins stay where they slide, which is Mölkky's "stand them up where they fell" for free. Open question: from above, what counts as a pin knocked over (moved some distance, pushed off its spot)? Prototype that first. Up to 12 pucks colliding. Mölkky is likely a trademark of its Finnish maker, so give it a plain name (like "Pins") and a blurb like "the Finnish throwing game", as with Paddles and Breaker. There's already a standalone Molkky project to borrow from.
- **Skittles.** A simple mode inside the Mölkky remake (knock down as many as you can, best of N), not its own game: two pin games would read as near-duplicates.
- **Foosball.** Real time, like Air Hockey, not turn based. Great face to face across one device. New input: drag a rod to slide it, swipe to kick. Four rods a side crowds a phone, so 2 or 3 each. The biggest build here.
- **Plinko (for little kids).** Mostly luck with one choice (where to drop), which is what makes it easy for little kids: anyone can play and win. Cheap to build: a puck bouncing off fixed pegs, no puck-on-puck collisions needed. Notes: the board is vertical, unlike the rest of the pack; take turns and compare scores for a head-to-head; Plinko is The Price Is Right's trademark, so give it a plain name and a blurb like "the classic peg drop game".
