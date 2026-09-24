#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_root"

if [[ -n "${JAVA_HOME:-}" ]]; then
  if command -v cygpath >/dev/null 2>&1; then
    JAVA_HOME="$(cygpath -u "$JAVA_HOME")"
  fi
else
  for candidate in \
    "$HOME"/.jdks/jbr-21* \
    "$HOME"/.jdks/jdk-21* \
    "$HOME"/.jdks/jdk-17*; do
    if [[ -x "$candidate/bin/java" || -x "$candidate/bin/java.exe" ]]; then
      JAVA_HOME="$candidate"
      break
    fi
  done
fi

if [[ -z "${JAVA_HOME:-}" ]]; then
  echo "JDK 17 or 21 was not found. Set JAVA_HOME and run this script again." >&2
  exit 1
fi

java_executable="$JAVA_HOME/bin/java"
if [[ ! -x "$java_executable" && -x "$java_executable.exe" ]]; then
  java_executable="$java_executable.exe"
fi

if [[ ! -x "$java_executable" ]]; then
  echo "JAVA_HOME does not contain a Java executable: $JAVA_HOME" >&2
  exit 1
fi

java_version="$($java_executable -version 2>&1 | head -n 1)"
if [[ ! "$java_version" =~ \"(17|21)(\.|\") ]]; then
  echo "This build requires JDK 17 or 21, but found: $java_version" >&2
  exit 1
fi

export JAVA_HOME
echo "Using JAVA_HOME=$JAVA_HOME"

npm run build
npm run android:sync

(
  cd android
  ./gradlew assembleRelease
)

gradle_release_apk="$project_root/android/app/build/outputs/apk/release/app-release.apk"
release_directory="$project_root/release"
release_apk="$release_directory/com.nissan.speedcams-v1.0.apk"

if [[ ! -f "$gradle_release_apk" ]]; then
  echo "Release build completed, but the signed APK was not found at $gradle_release_apk" >&2
  exit 1
fi

mkdir -p "$release_directory"
cp -f "$gradle_release_apk" "$release_apk"

if [[ ! -f "$release_apk" ]]; then
  echo "Failed to copy the signed APK to $release_apk" >&2
  exit 1
fi

android_root="$project_root/android"
generated_android_paths=(
  "$android_root/.gradle"
  "$android_root/build"
  "$android_root/app/build"
  "$android_root/app/release"
  "$android_root/capacitor-cordova-android-plugins"
  "$android_root/app/src/main/assets/public"
  "$android_root/app/src/main/assets/capacitor.config.json"
  "$android_root/app/src/main/assets/capacitor.plugins.json"
  "$android_root/app/src/main/res/xml/config.xml"
)

for generated_path in "${generated_android_paths[@]}"; do
  case "$generated_path" in
    "$android_root"/*) ;;
    *)
      echo "Refusing to remove a path outside the Android directory: $generated_path" >&2
      exit 1
      ;;
  esac
done

for generated_path in "${generated_android_paths[@]}"; do
  rm -rf -- "$generated_path"
done

echo "Signed release APK: ${release_apk#$project_root/}"
echo "Removed generated Android build content."
