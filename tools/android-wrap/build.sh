#!/bin/zsh
# Rebuilds the Android demo APKs for the two SwiftUI apps from their web prototypes.
#   tools/android-wrap/build.sh            both
#   tools/android-wrap/build.sh forge      or: wakemethere
# Each prototype is wrapped with appmode.css/js (hides the iPhone frame, scales the 360x780 screen to fit),
# packaged with Capacitor in <App>/android-app, and copied to downloads/.
set -e
T=${0:A:h}; P=${T:h:h}/downloads
gen() { python3 - "$1" "$T" <<'PY'
import sys,pathlib
app,T=sys.argv[1],sys.argv[2]
s=pathlib.Path(f'{pathlib.Path.home()}/Documents/{app}/prototype/index.html').read_text()
css=pathlib.Path(T+'/appmode.css').read_text(); js=pathlib.Path(T+'/appmode.js').read_text()
pathlib.Path(f'{T}/{app}.html').write_text(s.replace('</head>','<style id="android-app-mode">'+css+'</style>\n<script>'+js+'</script>\n</head>',1))
PY
}
if [[ -z $1 || $1 == forge ]]; then gen ForgeTrainer; $T/make.sh ForgeTrainer com.gopinath.forgetrainer "Forge" $T/forge-icon.png $P/forge.apk; fi
if [[ -z $1 || $1 == wakemethere ]]; then gen WakeMeThere; $T/make.sh WakeMeThere com.gopinath.wakemethere "Wake Me There" ~/Documents/WakeMeThere/WakeMeThere/Assets.xcassets/AppIcon.appiconset/icon-1024.png $P/wake-me-there.apk; fi
