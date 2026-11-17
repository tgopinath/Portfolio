#!/bin/zsh
# Rebuilds the Android demo APKs for the two SwiftUI apps from their web prototypes.
#   tools/android-wrap/build.sh            both
#   tools/android-wrap/build.sh forge      or: wakemethere
# Each prototype (with its kolam/ and m3/ folders) is wrapped with appmode.css/js (hides the iPhone frame, scales the 360x780 screen to fit),
# packaged with Capacitor in <App>/android-app, and uploaded to that app's GitHub release (the portfolio links there).
set -e
T=${0:A:h}; P=$(mktemp -d)
ROOT="$HOME/Documents/All pets"
# gen <App>: copies <App>/prototype (page + kolam/ + m3/) to a temp www-<App> and injects app mode into index.html.
gen() {
  rm -rf "$P/www-$1"; mkdir -p "$P/www-$1"
  rsync -a --exclude shots --exclude '*.md' --exclude case-study.html --exclude screens.html --exclude '.vercel' "$ROOT/$1/prototype/" "$P/www-$1/"
  python3 - "$P/www-$1/index.html" "$T" <<'PY'
import sys,pathlib
f,T=pathlib.Path(sys.argv[1]),sys.argv[2]
s=f.read_text()
css=pathlib.Path(T+'/appmode.css').read_text(); js=pathlib.Path(T+'/appmode.js').read_text()
f.write_text(s.replace('</head>','<style id="android-app-mode">'+css+'</style>\n<script>'+js+'</script>\n</head>',1))
PY
}
export WWW_DIR=$P
if [[ -z $1 || $1 == forge ]]; then gen ForgeTrainer; $T/make.sh ForgeTrainer com.gopinath.forgetrainer "Forge" $T/forge-icon.png $P/forge.apk; ~/.local/bin/gh release upload v1.0.0 "$P/forge.apk" -R tgopinath/ForgeTrainer --clobber; echo "Uploaded to https://github.com/tgopinath/ForgeTrainer/releases/latest/download/$(basename "$P/forge.apk")"; fi
if [[ -z $1 || $1 == wakemethere ]]; then gen WakeMeThere; $T/make.sh WakeMeThere com.gopinath.wakemethere "Wake Me There" "$ROOT/WakeMeThere/WakeMeThere/Assets.xcassets"/AppIcon.appiconset/icon-1024.png $P/wake-me-there.apk; ~/.local/bin/gh release upload v1.0.0 "$P/wake-me-there.apk" -R tgopinath/WakeMeThere --clobber; echo "Uploaded to https://github.com/tgopinath/WakeMeThere/releases/latest/download/$(basename "$P/wake-me-there.apk")"; fi
