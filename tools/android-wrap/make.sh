#!/bin/zsh
# make.sh <AppFolder> <appId> <App Name> <icon.png> <out.apk>
set -e
APP=$1 ID=$2 NAME=$3 ICON=$4 OUT=$5
S=${0:A:h}; ROOT="$HOME/Documents/All pets"; D="$ROOT/$APP/android-app"; SHELL_SRC="$ROOT/solar-dry-house/android-app"
rm -rf "$D/www"; mkdir -p "$D/www"
cp -R "${WWW_DIR:-$S}/www-$APP/." "$D/www/"
cp "$SHELL_SRC/package.json" "$SHELL_SRC/package-lock.json" "$D/"
cd "$D" && rm -rf node_modules && cp -cR "$SHELL_SRC/node_modules" node_modules && rm -rf node_modules/@capacitor/geolocation
python3 -c "import json;d=json.load(open('package.json'));d['name']='$APP'.lower()+'-android';d.get('dependencies',{}).pop('@capacitor/geolocation',None);json.dump(d,open('package.json','w'),indent=2)"
printf '{ "appId": "%s", "appName": "%s", "webDir": "www" }\n' "$ID" "$NAME" > capacitor.config.json
[ -d android ] || npx cap add android
npx cap sync android
sed -i '' 's#gradle-8.14.3-all.zip#gradle-9.4.1-bin.zip#' android/gradle/wrapper/gradle-wrapper.properties
R=android/app/src/main/res
for p in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do n=${p%%:*}; px=${p##*:}; for f in ic_launcher ic_launcher_round; do sips -z $px $px "$ICON" --out $R/mipmap-$n/$f.png >/dev/null; done; done
rm -rf $R/mipmap-anydpi-v26
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk"
cd android && ./gradlew --no-daemon --init-script "$HOME/Documents/android-wrappers/maven-mirror.gradle" assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk "$OUT"
echo "BUILT $OUT"
