#!/usr/bin/env bash
set -euo pipefail

root_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
flatpak_directory="$root_directory/flatpak"
deb_bundle_directory="$root_directory/src-tauri/target/release/bundle/deb"
deb_input_directory="$flatpak_directory/.deb-input"
build_directory="$flatpak_directory/.build"
repo_directory="$flatpak_directory/.repo"
output_directory="$flatpak_directory/output"
manifest_path="$flatpak_directory/com.sigma-file-manager.app.yml"
app_id="com.sigmafilemanager.app"
runtime_ref="org.gnome.Platform/x86_64/48"

version="$(node -p "require('$root_directory/package.json').version")"
bundle_path="$output_directory/Sigma-File-Manager-${version}-linux.flatpak"

find_deb_package() {
  if [ ! -d "$deb_bundle_directory" ]; then
    return
  fi

  find "$deb_bundle_directory" -maxdepth 1 -name "*_${version}_*.deb" -print -quit
}

ensure_deb_package() {
  local deb_package
  deb_package="$(find_deb_package || true)"
  if [ -n "$deb_package" ]; then
    echo "$deb_package"
    return
  fi

  echo "No .deb bundle found for version $version. Building with Tauri..." >&2
  (
    cd "$root_directory"
    npm run sync-version >&2
    NO_STRIP=true npm run tauri build -- --bundles deb >&2
  )

  deb_package="$(find_deb_package || true)"
  if [ -z "$deb_package" ]; then
    echo "Tauri did not produce a .deb package for version $version." >&2
    exit 1
  fi
  echo "$deb_package"
}

ensure_flatpak_runtime() {
  if ! command -v flatpak >/dev/null 2>&1; then
    echo "flatpak is not installed."
    exit 1
  fi
  if ! command -v flatpak-builder >/dev/null 2>&1; then
    echo "flatpak-builder is not installed."
    exit 1
  fi

  if flatpak info --user "$runtime_ref" >/dev/null 2>&1 \
    || flatpak info --system "$runtime_ref" >/dev/null 2>&1; then
    return
  fi

  flatpak remote-add --if-not-exists --user flathub https://flathub.org/repo/flathub.flatpakrepo
  flatpak install -y --noninteractive --user flathub org.gnome.Platform//48 org.gnome.Sdk//48
}

deb_package="$(ensure_deb_package)"
mkdir -p "$deb_input_directory" "$output_directory"
cp "$deb_package" "$deb_input_directory/sigma-file-manager.deb"

rm -rf "$build_directory" "$repo_directory"
ensure_flatpak_runtime

flatpak-builder \
  --force-clean \
  --disable-cache \
  --repo="$repo_directory" \
  "$build_directory" \
  "$manifest_path"

rm -f "$bundle_path"
flatpak build-bundle "$repo_directory" "$bundle_path" "$app_id"

echo "Flatpak bundle created at $bundle_path"
