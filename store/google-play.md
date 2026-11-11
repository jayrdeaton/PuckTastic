# Google Play

PuckTastic for Android ships through Google Play, from the Infinite Token organization developer account (the one Lumber opened, 2026-11-11). The Android app is this repo's Expo app, package `com.infinitetoken.boxhockey` (BoxHockey's, like the iOS bundle ID; it can't change once on Play), built by EAS as an app bundle (`.aab`); Google signs it for the store with the Play App Signing key, and EAS keeps the upload key. It's a new app on Play: BoxHockey was never there, so this is a first release, not an update.

Checked 2026-11-11 against Play Console Help, the Developer Program Policies and Expo's store privacy declarations for EAS Update, following DuelTastic's `store/google-play.md` from the same day (the same family, the same data flows).

## What Google asks of PuckTastic

- **Target API level:** 36 (Android 16), Expo SDK 58's default (58.0.23 here), so nothing is set.
- **Selling:** nothing is sold, in the app or anywhere else, and there are no ads.
- **Account deletion:** no accounts. Player profiles are names and colors kept on the device.
- **Permissions:** `app.json`'s `android.blockedPermissions` takes out what Expo's template and libraries ask for and PuckTastic never uses: `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, and `ACTIVITY_RECOGNITION` (expo-sensors adds it for its step counter; Tilt Control reads the accelerometer, which needs none). What's left is the network (the update check), vibration (haptics), `MODIFY_AUDIO_SETTINGS` (expo-audio's sound effects) and the libraries' wake lock and network state. None needs a declaration form. No `AD_ID`.
- **Shared profiles are iOS and web only:** `@tastic/profile` has no Android module (its App Group bridge is Apple's), so on Android each Tastic game keeps its own profiles. The Android description leaves out the iOS line about sharing them.
- **The icon:** Android draws `app.json`'s adaptive icon (`android-icon-foreground.png` and `android-icon-monochrome.png` over `#050505`, made by `store/creative/android-icons.py`), so a launcher's mask never cuts the art and themed icons work.
- **Tablets and Chromebooks:** Android 16 ignores the portrait lock on screens 600dp and wider, so a tablet turns with the OS, as the iPad does (CLAUDE.md, "The OS turns tablets").
- **Hardware back:** `TODO.md`'s first "After launch" item (audit F093) is still open: Android's back gesture during a match leaves it at once, skipping "Quit Match?" (hud's `ConfirmDialog` only handles back while it's open). It says "before an Android release". Fix it in `@tastic/hud`/`@tastic/shell` first, or decide it can wait.

## Jay's steps, in order

1. **Finish the developer account** if it isn't yet (Lumber's `store/google-play.md`, steps 1 and 2: the payments profile, the $25 fee, then identity, organization and website verification).
2. **Decide on hardware back** (above): fix F093 before the first Android build, or ship without it.
3. **Create the app** (Play Console, Create app): name PuckTastic, default language English (United States), Game, Free, and the declarations.
4. **Fill in App content** (the answers below), the **store listing** and **store settings**.
5. **Build:** `jrd ship build production`, picking All (or Android). The first Android build makes the upload keystore on EAS. It carries the adaptive icon and blocked permissions, which are native.
6. **Upload the first bundle by hand** in Play Console (Production, Create new release): Google's API can't create an app's first release, so `eas submit -p android` only works from the second one on, with a service account key.
7. **Send for review** (Publishing overview). A new account's first app can take several days.
8. **After it's live:** the Play link (`https://play.google.com/store/apps/details?id=com.infinitetoken.boxhockey`) goes on PuckTastic's entry in Games-Web and on InfiniteToken-WWW's and JayDeaton-Web's cards (the site-alignment skill checks them).

Every later version: `jrd ship build production`, `eas submit -p android --profile production`, the release notes, then send for review.

## Store listing (main store listing)

**App name** (30 at most): `PuckTastic`

**Short description** (80 at most, 77 used):

> Box Hockey, Air Hockey, Paddles and Breaker in one. Play a friend or the CPU.

**Full description** (4000 at most; the iPhone text with three Android changes: "phone or tablet", the light and dark line, and no line about profiles shared between Tastic games):

```
Four tabletop puck games in one app: Box Hockey, Air Hockey, Paddles and Breaker. Play a friend face to face on one device, or the CPU. No ads, no accounts.

• Box Hockey: the classic wooden table game. Take turns shooting the puck through the gaps and into their goal. Three tip-offs (a Face-Off reaction race, a Coin Flip, or Triple Tap), three boards (Classic, Gauntlet, and Gravity), a Rink option, and four ways to shoot
• Air Hockey: the arcade table classic. Guard your goal and fire back, both players at once
• Paddles: the arcade original. Get the puck past their paddle
• Breaker: the classic brick breaker. Clear every brick on your own, or play head to head with bricks in the middle
• Two players face to face on one device, or one against the CPU (Easy, Medium, or Hard)
• Tilt Control: in Paddles and Breaker, tilt your phone or tablet to steer when you're the only player
• Set each game's score to win, puck speed, and more
• Player profiles, stats, and 138 achievements across the four games
• Light and dark mode, on phones and tablets
• Plays offline

Part of the Tastic family of games.

Open source on GitHub: https://github.com/jayrdeaton/PuckTastic
```

**Release notes** for the first release (500 at most): `PuckTastic's first release on Android.`

**Graphics** (in `store/screenshots/google-play/`, gitignored):

- **App icon:** `icon-512.png`, 512 x 512, 32-bit PNG with alpha, from `assets/images/icon-dark.png` (opaque, as the iOS icon). Google rounds its corners itself.
- **Feature graphic:** `feature-graphic.png`, 1024 x 500, no alpha, drawn by `node store/creative/build.mjs` from the App Store header's own drawing, its middle cut to Play's shape: Box Hockey's board on its side, red's end left and blue's right, a real shot just through a divider hole on its way into blue's goal. No words, no device frame.
- **Phone screenshots:** `store/screenshots/android/`, 1440x2560, the same seven shots and captions as the App Store's (`store/screenshots.json`), in this order, with this alt text (140 at most each):
  1. Tabletop Box Hockey: "Box Hockey against the CPU: the puck flies up the board through a gap toward the blue goal."
  2. Four Puck Games, No Ads: "PuckTastic's home screen listing Box Hockey, Air Hockey, Paddles and Breaker."
  3. Air Hockey, Face to Face: "Air Hockey for two players on one phone, red at the bottom and blue at the top, the puck between them."
  4. Paddles, the Arcade Original: "Paddles against the CPU: the puck crosses the court toward the red paddle, the blue paddle at the far end."
  5. Break Every Brick: "Breaker played alone: rows of bricks with some knocked out, and the puck heading back to the paddle."
  6. Pick Your Board: "Box Hockey's setup screen with the board picker open: Classic, Gauntlet and Gravity."
  7. Stats and 138 Achievements: "The Stats screen: a player's wins, goals and streaks, and achievements in bronze, silver and gold."
- **Tablet screenshots:** none yet (optional on Play). Taking them needs an Android tablet emulator, and there's only the one phone AVD (`Pixel_9`) for every app.

How the phone screenshots were made (2026-11-11): the shared `Pixel_9` emulator (Android 16, 1080x2424, audio off), a local release build from `npx expo prebuild -p android --clean` and `./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a`, with `debuggable true` added by hand to the release build type in the gitignored `android/app/build.gradle` so the seed can be copied in (never in a store build). SystemUI demo mode (9:41, full battery and bars, no notifications) and dark mode, as in the skill's Google Play reference. The seed is the App Store's (`store/seed/`), written with `python3 store/seed/write-store.py emulator-5554 --android [options]` (AsyncStorage's legacy `RKStorage` SQLite file, copied in with `run-as`; the app is stopped first). The same shots as on iOS (`store/README.md`, Screenshot notes), then `compose.mjs store/screenshots.json` (the `android` device: a bezel with the punch hole, the caption under 20% of the canvas). What worked on the emulator under load:

- **Presses:** a bare `adb shell input tap` often didn't register; `input swipe x y x y 150` (a short hold) did.
- **The status bar:** demo mode's mobile signal showed "3G" whatever `datatype` was given, so it's hidden (`-e command network -e mobile hide`), leaving 9:41, Wi-Fi and a full battery.
- **Box Hockey's flick:** a fast `input swipe` (60 ms) fires a shot. **Air Hockey's mallet and the paddles** didn't follow a quick swipe; `input motionevent DOWN`, `MOVE` (several), `UP` in one `adb shell` did, and a held `DOWN` with slow `MOVE`s and `sleep`s keeps a finger on the paddle for the serve.
- **Moving moments:** `adb shell screenrecord` failed or wrote an empty file about half the time, so the in-play shots are stills from a loop of `adb exec-out screencap -p` (about two a second) during play.
- **Launching:** `adb shell am start -n com.infinitetoken.boxhockey/.MainActivity` after each reseed; a cold start took over a minute under load, so wait for the window before pressing.
- Android back left a match at once (F093, still open), which is a quick way out of a round with a score you don't want.

## Store settings

- **App category:** Game, Sports (the App Store's primary category too).
- **Tags:** up to five from Play's list, picked in the console (Sports, Arcade, Local Multiplayer, Casual and Offline fit, if offered).
- **Contact details:** the account's developer email (public), website https://games.infinitetoken.com/pucktastic, no phone.

## App content

- **Privacy policy:** https://games.infinitetoken.com/privacy
- **App access:** All functionality is available without special access.
- **Ads:** No, the app doesn't contain ads.
- **Content rating** (IARC questionnaire): category Game. No violence (pucks, paddles and bricks; nobody is hurt), no fear, sexuality, language, controlled substances, crude humor or gambling. Users don't interact or share content with each other online (two players share one device), no location is shared, nothing is bought in the app, and there's no unrestricted internet access. They match the App Store's answers (`store/README.md`, Age rating).
- **Target audience:** 13 to 15, 16 to 17, and 18 and over, as Jay chose for DuelTastic (2026-11-11), so the Families policy doesn't apply. Play then asks whether the app could unintentionally appeal to children: the listing has no characters, mascots or child-directed words, so the answer is no unless Jay sees it differently. The IARC rating still says it suits everyone.
- **News app, government app, financial features, health:** no, no, none, none.
- **Advertising ID:** the app doesn't use one.
- **Data safety:** below.

## Data safety

Nothing the player makes (profiles, settings, stats, achievements) leaves the device. The only thing that does is the over-the-air update check (expo-updates, to Expo's EAS Update). Expo's store privacy guide (https://docs.expo.dev/eas-update/store-privacy-declarations/) gives Play's answers for it, the same as DuelTastic's:

| Data type | Collected or shared | Required | Purposes | Why |
| --- | --- | --- | --- | --- |
| Device or other IDs | Collected (Expo is a service provider, so not shared); not ephemeral | Required | App functionality, Analytics | expo-updates sends a random client ID made at install with every update check |
| App info and performance, Crash logs | Collected; not ephemeral | Required | Analytics | IDs of updates that failed to launch, and the launch error, sent back with the next check |

- **Does the app collect or share user data?** Yes (the two above).
- **Encrypted in transit?** Yes (HTTPS).
- **Can users request deletion?** No: there are no accounts, and nothing ties the client ID to a person. Deleting the app deletes its data.
- **Delete account URL:** none (no accounts).

The App Store's App Privacy declares the same (`store/README.md`).
