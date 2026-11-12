# App Store

Everything the iOS listing needs. PuckTastic ships as **version 2.0.0 of the existing BoxHockeyTastic record** (bundle ID `com.infinitetoken.BoxHockey`, Apple ID 6824717751, 1.1.1 live since 2026-10-21): a major update that renames the app and grows it from one game to four, not a new app. The text lives in `store.config.json` (repo root), which `eas metadata:push` sends to App Store Connect. The rest is set by hand in App Store Connect and carries over between versions.

Google Play is in `store/google-play.md`.

## Jay's steps, in order

For 2.0.0:

1. **Build:** `npm run verify`, then `jrd ship build production` (iOS, or All once Android is ready). The rename, react-native-svg, `@tastic/profile` and the other native changes since 1.1.1 need this new binary; no OTA update can carry them.
2. **Upload:** `eas submit -p ios --profile production` (to TestFlight). Install it from TestFlight on a phone that has 1.1.1 with some Box Hockey history, and check that the players, settings, stats and achievements came across (the one-time BoxHockey 1.0 import, CLAUDE.md "Saved data").
3. **Create version 2.0.0** in App Store Connect (iOS App, +, Version) if `eas metadata:push` doesn't make it.
4. **Push the listing:** `eas metadata:push`. It renames the record to PuckTastic (title and subtitle) and sends the description, keywords, promotional text, What's New and URLs. If Apple says the name is taken, the fix is a longer name that keeps the brand ("PuckTastic: Puck Games"); the home-screen label (`app.json`'s `expo.name`) can stay PuckTastic.
5. **App Privacy and age rating:** change App Privacy to the two expo-updates types (below; 1.1.1 said Data Not Collected), and answer the age rating questionnaire by hand (below). `store.config.json` no longer carries it, because eas-cli 27.7 can't send the Social Media answer and a push with it fails at the end.
6. **Screenshots and art:** delete the old Box Hockey screenshots, upload the three sets in `store/screenshots/`, and the header and search art (below).
7. **App Review notes:** replace the old notes with the ones below (the old ones describe Lock Orientation, which is gone).
8. **Pick the build** for 2.0.0, and **Add for Review**.
9. **Release:** manual (press Release once approved), since this one renames the app and changes what's on the product page.

Every later version: `npm run verify`, `jrd ship build production`, `eas submit -p ios --profile production`, new `releaseNotes` and `apple.version` in `store.config.json` (equal to `app.json`'s `version`), `eas metadata:push`, then pick the build and Add for Review.

## Pushed by EAS Metadata (`store.config.json`)

Title (`PuckTastic`), subtitle (`Four Puck Games. No Ads.`), promotional text, description, keywords, What's New (`releaseNotes`), marketing/support/privacy URLs (`games.infinitetoken.com/pucktastic`, `/support`, `/privacy`), copyright and categories (Games > Sports, Casual). Not the age rating (below).

```bash
eas metadata:lint
```

```bash
eas metadata:push
```

`push` edits the version matching `apple.version` (2.0.0, kept equal to `app.json`'s `expo.version`). Without it push fails with "missing versionString" and quietly skips the copyright, promotional text, description, keywords and the support/marketing URLs.

Limits: title 30, subtitle 30, promotional text 170 (editable any time without review), description 4000, keywords 100 in total with the commas (97 used). Keywords don't repeat the title or subtitle's words ("four", "puck", "games", "ads" are indexed from the subtitle; "PuckTastic" is one word, so it doesn't match a search for "puck" or "hockey" on its own, which is why "hockey" leads the keywords). No "pong" or "breakout": those are Atari's marks, and the app never names them.

The description counts 138 achievements (Box Hockey 33, Air Hockey 33, Paddles 33, Breaker 39), names Box Hockey's three tip-offs, three boards, Rink and four shot styles, the CPU's three levels and Tilt Control. Recheck those when a catalog or an option changes.

**What's New for 2.0.0** (in `store.config.json`, 509 characters):

> BoxHockeyTastic is now PuckTastic: four puck games in one app.
>
> • Air Hockey: the arcade table classic. Guard your goal and fire back, both players at once
> • Paddles: the arcade original. Get the puck past their paddle
> • Breaker: the classic brick breaker, on your own or head to head
> • Pick your opponent in each game: the CPU at Easy, Medium, or Hard, or a friend across the table
> • Stats and achievements for every game, 138 in all
> • Your players, Box Hockey settings, stats, and achievements come with you

## Screenshots (uploaded by hand)

Three sets, the same shots and captions in each, in `store/screenshots/` (gitignored, like the raw captures they're made from):

- `iphone-medium/` (1206x2622): **required.** App Store Connect's iPhone slot is "iPhone with Dynamic Island (medium display)", labelled 6.1"/6.3", and only takes 1206x2622 or 1179x2556. Composed from the 6.9" captures, scaled.
- `iphone/` (6.9", 1320x2868): optional slot.
- `ipad/` (13", 2064x2752): required because `ios.supportsTablet` is on.

Check Apple's [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) before each release. iPhone Duo (the foldable) gets its own optional slot, required from April 2027 for builds on the iOS 27.1 SDK or later: capture it on a Duo simulator once Xcode has one. The order in the folder is the upload order; the first three are what search results show. The captions are in `store/screenshots.json`.

How they were made: see "Screenshot notes" at the end. Seven shots, the first three what search shows: Box Hockey in play, Home's four games, Air Hockey face to face, Paddles, Breaker alone, Box Hockey's board picker, and the achievements.

## Header and search results art (uploaded by hand, optional, iOS 27+)

`store/screenshots/header.png` (3840 x 1646) and `store/screenshots/search.png` (3840 x 2560), gitignored like the screenshots, drawn by `node store/creative/build.mjs` (which also draws Google Play's feature graphic). Board.tsx is Skia, which doesn't render outside the app, so the header is an SVG redraw of Board's own shapes from the app's real geometry and colors: `computeBoardLayout` on the iPhone 17 Pro Max layout (Classic, medium puck, Rink off), `faceoffZoneCenters`, `computeGoalWedges`, the pack's seat colors (read from `src/pack.ts`) and Board's dark-mode white walls and lines.

- **Header:** Box Hockey's whole box on its side, red end left and blue end right, red on match point (4 of 5 arcs lit), and the puck just through a divider hole on its way into the blue goal, with fading copies of where it was. The flight is a real shot played out on `stepPhysics` (the script fails if it ever stops scoring). No words: the name sits right under it. The whole box, walls and goals included, sits inside what every device shows of the header in App Store Connect's Device Preview (y 220-1260, within iPad landscape's y 190-1290, centered at 740), at about 2.3x the board's points (2026-11-12: at 3.2x its long walls ran past the top and bottom on iPad landscape, and the rink looked open there). Play's feature graphic keeps the 3.2x drawing (`store/google-play.md`).
- **Search results:** "Four Puck Games / Play a Friend or the CPU" in SF Mono Bold (the screenshots' caption font) beside Home's capture in a phone (`store/screenshots/raw/iphone/02-home.png`, so take the screenshots first): the four games, by name and icon. App Store Connect's Device Preview shows the iPhone's search card as only the top of the image (the full width, y 0 to about 1500), so the words are centered in that strip and the phone is sized and placed so Home's title and all four game rows sit above y 1470 (2026-11-12: lower down, in Apple's template safe area from y 765, the subline fell below the strip, as SlingScan's and CardTastic's did). The iPad shows the whole image.

Each comes with `-safe.png` (the safe area from Apple's templates outlined, and for search the iPhone's crop in cyan) and `-384.png` (about a search card's size on a phone), and the search art with `-iphone.png` (what the iPhone's search card shows), rendered through the app-store-prep skill's `creative.mjs`, which checks the size and strips any alpha channel.

Upload in the version's Product Page Information > Header and Search Results (Header, then Search Results), then check both with Preview (iPhone and iPad, both orientations). The header has no words, so it can go on every localization; the search image's words are English, so it goes on English only. They're reviewed with the version, or on their own through Asset Library. EAS Metadata can't push them.

## Set by hand in App Store Connect

**Age rating** (App Information, Age Rating; set by hand until eas-cli can send the Social Media answer): every content question None (violence of every kind, sexual content, profanity or crude humor, alcohol, tobacco or drugs, horror or fear, mature or suggestive themes, medical information, guns or other weapons, simulated gambling, contests), and No for Gambling, Loot Boxes, Advertising, Messaging and Chat, User-Generated Content, Social Media, Unrestricted Web Access, Parental Controls, Age Assurance and Health or Wellness Topics. That gives 4+, as 1.1.1 had. Google Play's IARC answers (`store/google-play.md`) match these.

**App Privacy** (changed for 2.0.0, following Jay's DuelTastic decision of 2026-11-11 and Expo's store privacy guide, https://docs.expo.dev/eas-update/store-privacy-declarations/; 1.1.1 said "Data Not Collected"): "Yes, we collect data from this app", two types, both from the over-the-air update check (expo-updates to Expo's EAS Update), and nothing the player makes (profiles, settings, stats) ever leaves the device:

| Data type | Purposes | Linked to the user | Tracking |
| --- | --- | --- | --- |
| Identifiers, Device ID | App Functionality, Analytics | No | No |
| Diagnostics, Crash Data | App Functionality | No | No |

The Device ID is the random client ID expo-updates makes at install and sends with every update check; the crash data is the IDs of updates that failed to launch and the launch error, sent back with the next check. The privacy policy at https://games.infinitetoken.com/privacy already describes the check and its random installation ID. There's no tracking, so no App Tracking Transparency prompt. The three new games add nothing that leaves the device. This matches the Data safety answers in `store/google-play.md`. Revisit it if analytics, crash reporting, ads or accounts are ever added.

**App Review Information:** sign-in not required. Contact: name, email and phone (the phone stays out of `store.config.json`, which is public). Notes (replace 1.1.1's):

> No account or sign-in is needed, and there are no in-app purchases or ads.
>
> This version renames BoxHockeyTastic to PuckTastic and adds three games beside Box Hockey: Air Hockey, Paddles and Breaker. Tap a game on the Home screen to open it. The first time, a short How to Play guide appears (tap Skip to close it); then the game's setup screen opens. Tap Ready? to start.
>
> Each game is played against the CPU by default. On the setup screen, the button beside your player button (it shows the CPU's level) changes the opponent: the CPU at Easy, Medium or Hard, Player (a second person on the same device), or Solo (Breaker only). Two players sit across from each other, so the far player's cards and messages face the other way on purpose.
>
> Box Hockey: players take turns. Swipe fast anywhere to shoot the puck the way you swipe. Every point starts with a face-off: tap your own half to get ready, then be first to tap your circle that lights up. Against the CPU only your half needs a tap.
>
> Air Hockey: both players play at once. Your paddle follows your finger in your own half.
>
> Paddles and Breaker: drag along your end to move your paddle. Each serve waits until every player has a finger on their side of the screen, so keep a finger down to start play. With Tilt Control on (one player on a device), tilting the device steers instead.
>
> Phones stay in portrait. On iPad the app turns with the device, and Air Hockey, Paddles and Breaker seat two players side by side in landscape.
>
> Player profiles are shared through an App Group with other Tastic games by the same developer, if any are installed. No profile, progress or other game data leaves the device.

**Content Rights:** no third-party content to declare beyond the platform and the open-source libraries: the art and sounds are original (the sounds are the generated set made for the Tastic games), the icons are Material Design Icons (Apache 2.0, through `@expo/vector-icons`), and the type is the system fonts (SF and Menlo).

**Pricing and Availability:** Free, all territories (unchanged).

**Export compliance:** already answered by `ITSAppUsesNonExemptEncryption: false` in `app.json`, so App Store Connect doesn't ask.

**Accessibility (optional):** leave blank until each feature has been checked on a device. Apple asks per feature (VoiceOver, Larger Text, Dark Interface, Reduced Motion and so on), and a claim that doesn't hold up is worse than none.

**Version release:** manual for 2.0.0 (you press Release).

## Screenshot notes

Made 2026-11-11 for 2.0.0: a Release build on the iPhone 17 Pro Max and iPad Pro 13" (M5) simulators, status bar pinned to 9:41 with full battery, dark appearance. The saved data was written before first launch (sound off, every game's How to Play seen, Sam and Riley's profiles, and three weeks of Box Hockey stats and achievements from 53 matches played out on the app's own physics, CPU planner and face-off knock). The in-play shots (Box Hockey, Air Hockey, Paddles, Breaker) are frames from screen recordings of real play. A compositor puts each capture under its caption in SF Mono Bold on black.

The tools (simulator setup, the slim build, frame picking, the compositor, the art renderer) are in Jay's `app-store-prep` skill; the PuckTastic-specific seeding and art are here in `store/seed/` and `store/creative/`. The simulators are the shared `AppStore iPhone 6.9` and `AppStore iPad 13` (one of each kind for every app, kept between releases); take turns with any other session using them.

1. `node store/seed/generate.mjs` (writes `store/seed/seed.json`, gitignored)
2. Build and install a Release copy on both simulators (the skill's `sim-build.sh` and `sim-setup.sh --app`). `npx expo prebuild -p ios` first if there's no `ios/`, with `LANG=en_US.UTF-8` set or CocoaPods fails on the locale.
3. `store/seed/reseed.sh <udid> [options]` on each, then capture into `store/screenshots/raw/<device>/<name>.png`:
   - **01-boxhockey:** `--difficulty hard`, Box Hockey, Ready, tap your half for the face-off, then (on your turn, the puck ringed red) record and flick a shot. A swipe sent in one step doesn't register as a flick; send a touch path of several points 16 ms apart. Use a frame with the puck in flight, after the chips fade and before any touch ring.
   - **02-home:** Home as it opens.
   - **03-airhockey:** `--mode twoPlayer`, Air Hockey, both Ready, record, then a two-finger path: red's mallet driven up into the puck at center while blue's drifts out. Use a frame with the puck between the two mallets once the chips have faded.
   - **04-paddles:** the default seed (the CPU), Paddles, Ready, record, then hold a finger on your side for 10 s or more (the serve waits for it). Use a frame from the first rally, at 0 to 0.
   - **05-breaker:** `--mode solo`, Breaker, Ready, record, then hold a finger on your side for 20 s, moving it slowly from side to side. Use a frame with some bottom-row bricks gone and the puck coming off them, before Out of Lives.
   - **06-boards:** `--mode twoPlayer`, Box Hockey, tap the board dial (the first one).
   - **07-stats:** the trophy on Home, then the Achievements tab.
4. The skill's `compose.mjs store/screenshots.json` (writes every set, Android's included, so capture Android's too or compose with a copy that lists only the iOS devices)
5. Clear Sam and Riley out of the simulators' shared Tastic roster, or the next app shot on them shows them too: PuckTastic copies its seeded profiles into the empty App Group (`@tastic/profile`'s `resolveInitialProfiles`). Shut the simulators down, then remove `sharedProfiles` from `group.com.infinitetoken.tastic.plist` in each one's `data/Containers/Shared/AppGroup/<id>/Library/Preferences/` (`plutil -remove sharedProfiles <plist>`)

The seed writes `pucktastic:root` with the pack's store keys (`boxhockeySettings`, `boxhockeyAchievements`, `opponent` and so on), so it needs a PuckTastic build (from 2026-10-24); an older install ignores it and opens with sound on and How to Play unseen.

Simulator notes: a fresh launch after `reseed.sh` (or after a reboot) can sit on the splash for a minute or two, and `simctl launch` can block that long, so run it in the background. The simulator's touch ring shows in screen recordings for a moment after each tap or swipe. The recorder only writes a frame when the screen changes, so on a still board the skill's `frames.mjs` sheet and grab disagree on timestamps; pull the exact frame with ffmpeg's `select` instead.
