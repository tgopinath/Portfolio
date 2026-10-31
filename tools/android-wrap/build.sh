#!/bin/zsh
# Rebuilds the Android demo APKs for the two SwiftUI apps from their web prototypes.
#   tools/android-wrap/build.sh            both
#   tools/android-wrap/build.sh forge      or: wakemethere
# Each prototype is wrapped with appmode.css/js (hides the iPhone frame, scales the 360x780 screen to fit),
# packaged with Capacitor in <App>/android-app, and uploaded to that app's GitHub release (the portfolio links there).
set -e
T=${0:A:h}; P=$(mktemp -d)
gen() { python3 - "$1" "$T" <<'PY'
import sys,pathlib
app,T=sys.argv[1],sys.argv[2]
s=pathlib.Path(f'{pathlib.Path.home()}/Documents/{app}/prototype/index.html').read_text()
css=pathlib.Path(T+'/appmode.css').read_text(); js=pathlib.Path(T+'/appmode.js').read_text()
pathlib.Path(f'{T}/{app}.html').write_text(s.replace('</head>','<style id="android-app-mode">'+css+'</style>\n<script>'+js+'</script>\n</head>',1))
PY
}
if [[ -z $1 || $1 == forge ]]; then gen ForgeTrainer; $T/make.sh ForgeTrainer com.gopinath.forgetrainer "Forge" $T/forge-icon.png $P/forge.apk; ~/.local/bin/gh release upload v1.0.0 "$P/forge.apk" -R tgopinath/ForgeTrainer --clobber; echo "Uploaded to https://github.com/tgopinath/ForgeTrainer/releases/latest/download/$(basename "$P/forge.apk")"; fi
if [[ -z $1 || $1 == wakemethere ]]; then gen WakeMeThere; $T/make.sh WakeMeThere com.gopinath.wakemethere "Wake Me There" ~/Documents/WakeMeThere/WakeMeThere/Assets.xcassets/AppIcon.appiconset/icon-1024.png $P/wake-me-there.apk; ~/.local/bin/gh release upload v1.0.0 "$P/wake-me-there.apk" -R tgopinath/WakeMeThere --clobber; echo "Uploaded to https://github.com/tgopinath/WakeMeThere/releases/latest/download/$(basename "$P/wake-me-there.apk")"; fi
