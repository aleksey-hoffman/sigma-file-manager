#!/usr/bin/env bash
# Builds Sigma File Manager on Arch-based Linux (native binary + AppImage + .deb)
# and copies the resulting artifacts into ./release.
set -euo pipefail

root_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
release_directory="$root_directory/release"
bundle_directory="$root_directory/src-tauri/target/release/bundle"
binary_name="sigma-file-manager"

clean_build=0
native_cpu=0

for arg in "$@"; do
  case "$arg" in
    --clean) clean_build=1 ;;
    --native) native_cpu=1 ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--clean] [--native]"
      echo "  --clean   run 'cargo clean' before building for a fully fresh build"
      echo "  --native  compile with -C target-cpu=native (binary tied to this CPU)"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: '$1' is required but not installed." >&2
    exit 1
  fi
}

require node
require npm
require cargo

version="$(node -p "require('$root_directory/package.json').version")"

echo "==> Sigma File Manager v$version — Arch Linux build"

cd "$root_directory"

if [ ! -d node_modules ]; then
  echo "==> Installing npm dependencies"
  npm ci
fi

if [ "$clean_build" -eq 1 ]; then
  echo "==> Cleaning previous Rust build artifacts"
  (cd src-tauri && cargo clean)
fi

if [ "$native_cpu" -eq 1 ]; then
  echo "==> Compiling with target-cpu=native (not portable to other machines)"
  export RUSTFLAGS="${RUSTFLAGS:-} -C target-cpu=native"
fi

echo "==> Building (frontend + Tauri release bundle)"
npm run tauri:build:linux

mkdir -p "$release_directory"

copied_any=0

copy_artifact() {
  local src="$1"
  if [ -f "$src" ]; then
    cp -f "$src" "$release_directory/"
    echo "==> Copied: $(basename "$src")"
    copied_any=1
  fi
}

# Portable binary
copy_artifact "$root_directory/src-tauri/target/release/$binary_name"

# AppImage
appimage_file="$(find "$bundle_directory/appimage" -maxdepth 1 -name "*.AppImage" -print -quit 2>/dev/null || true)"
[ -n "$appimage_file" ] && copy_artifact "$appimage_file"

# .deb (kept for reference/compatibility, still useful via debtap on Arch)
deb_file="$(find "$bundle_directory/deb" -maxdepth 1 -name "*.deb" -print -quit 2>/dev/null || true)"
[ -n "$deb_file" ] && copy_artifact "$deb_file"

if [ "$copied_any" -eq 0 ]; then
  echo "Error: no build artifacts were found to copy." >&2
  exit 1
fi

echo "==> Done. Artifacts available in: $release_directory"
