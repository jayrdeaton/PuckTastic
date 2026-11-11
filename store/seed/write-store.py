#!/usr/bin/env python3
"""Writes the screenshot seed (store/seed/seed.json, from generate.mjs) into a simulator's BoxHockey
install BEFORE it launches, so it opens on Home with sound off, the guide seen, Sam and Riley's
profiles, three weeks of stats and achievements, and the match settings a shot needs. See
store/README.md.

  write-store.py <simulator udid> [--mode vsCpu|twoPlayer|solo] [--board classic|gauntlet|gravity] [--rink]
                 [--preview off|short|medium|long] [--scheme flick|stick|pull|push]
                 [--difficulty easy|medium|hard] [--tipoff faceoff|coinFlip|tripleTap]
  write-store.py --android <adb serial> [the same options]

Defaults: Vs CPU on Medium, Classic, no Rink, the default Face-Off and Flick, preview off. Sam is in
seat 1; Riley takes seat 2 in Two Player. Solo leaves seat 2 empty (Breaker's Solo; the other games
read it as the CPU). The app must not be running.

On Android (--android) the store is the same value in AsyncStorage's legacy SQLite file,
databases/RKStorage (table catalystLocalStorage, user_version 1), copied in with run-as, so it needs a
debuggable build (store/README.md, Android). The app must have been installed, and is stopped first.

The store is redux-persist on @react-native-async-storage: on iOS, Library/Application Support/<bundle
id>/RCTAsyncLocalStorage_V1, with values over 1024 characters in a file named by the MD5 of the key.
The key is src/pack.ts's keyPrefix plus redux-persist's key ('pucktastic:root'), and the slices are
the store keys the pack mounts (Box Hockey's are boxhockey*); keep both in step with the app, or it
ignores everything this writes. Slices left out keep their initial state, and settings missing a
field get it from DEFAULT_SETTINGS.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess

BUNDLE = 'com.infinitetoken.BoxHockey'
KEY = 'pucktastic:root'
HERE = os.path.dirname(os.path.abspath(__file__))

parser = argparse.ArgumentParser()
parser.add_argument('udid', help='simulator udid, or the adb serial with --android')
parser.add_argument('--android', action='store_true')
parser.add_argument('--mode', default='vsCpu', choices=['vsCpu', 'twoPlayer', 'solo'])
parser.add_argument('--board', default='classic', choices=['classic', 'gauntlet', 'gravity'])
parser.add_argument('--rink', action='store_true')
parser.add_argument('--preview', default='off', choices=['off', 'short', 'medium', 'long'])
parser.add_argument('--scheme', default='flick', choices=['flick', 'stick', 'pull', 'push'])
parser.add_argument('--difficulty', default='medium', choices=['easy', 'medium', 'hard'])
parser.add_argument('--tipoff', default='faceoff', choices=['faceoff', 'coinFlip', 'tripleTap'])
args = parser.parse_args()

seed = json.load(open(os.path.join(HERE, 'seed.json')))
sam, riley = (p['id'] for p in seed['profiles'])

root = {
    'boxhockeyAchievements': {'stats': seed['stats'], 'unlocked': seed['unlocked']},
    'sound': {'enabled': False},
    # Every game's How to Play seen, so no cards open over a shot.
    'boxhockeyGuide': {'versionSeen': 1},
    'airhockeyGuide': {'versionSeen': 1},
    'paddlesGuide': {'versionSeen': 1},
    'breakerGuide': {'versionSeen': 1},
    'profiles': seed['profiles'],
    'profileSelection': {'1': sam, '2': riley if args.mode == 'twoPlayer' else None},
    # Seat 2, for the whole pack: a person in Two Player, nobody in Solo, the CPU otherwise.
    'opponent': {'seatTwo': {'twoPlayer': 'person', 'solo': 'nobody'}.get(args.mode, 'cpu')},
    # Box Hockey's loadout is per player (src/shared/playerSettings.ts): the match settings are
    # seat 1's player's (Sam's), and each player keeps their own shot style.
    'boxhockeySettings': {
        sam: {
            'boardVariant': args.board,
            'rink': args.rink,
            'shotPreviewLength': args.preview,
            'aiDifficulty': args.difficulty,
            'tipoffMode': args.tipoff,
        },
    },
    'boxhockeyControls': {sam: args.scheme, riley: args.scheme},
}
value = {k: json.dumps(v) for k, v in root.items()}
value['_persist'] = json.dumps({'version': -1, 'rehydrated': True})
text = json.dumps(value)
done = f'Seeded {args.mode} on {args.board}{" with Rink" if args.rink else ""} ({len(text)} characters)'

if args.android:
    import sqlite3
    import tempfile
    package = 'com.infinitetoken.boxhockey'
    adb = ['adb', '-s', args.udid]
    db = os.path.join(tempfile.mkdtemp(), 'RKStorage')
    con = sqlite3.connect(db)
    con.execute('CREATE TABLE catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    con.execute('INSERT INTO catalystLocalStorage VALUES (?, ?)', (KEY, text))
    con.execute('PRAGMA user_version = 1')
    con.commit()
    con.close()
    subprocess.run(adb + ['shell', 'am', 'force-stop', package], check=True)
    subprocess.run(adb + ['push', db, '/data/local/tmp/RKStorage'], check=True, capture_output=True)
    subprocess.run(adb + ['shell', f"run-as {package} sh -c 'mkdir -p databases && rm -f databases/RKStorage* && cp /data/local/tmp/RKStorage databases/RKStorage'"], check=True)
    subprocess.run(adb + ['shell', 'rm', '/data/local/tmp/RKStorage'], check=True)
    print(done)
    raise SystemExit(0)

container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', args.udid, BUNDLE, 'data'], text=True).strip()
store_dir = os.path.join(container, 'Library/Application Support', BUNDLE, 'RCTAsyncLocalStorage_V1')
shutil.rmtree(store_dir, ignore_errors=True)
os.makedirs(store_dir)
manifest = {}
if len(text) > 1024:
    open(os.path.join(store_dir, hashlib.md5(KEY.encode()).hexdigest()), 'w').write(text)
    manifest[KEY] = None
else:
    manifest[KEY] = text
json.dump(manifest, open(os.path.join(store_dir, 'manifest.json'), 'w'))
print(done)
