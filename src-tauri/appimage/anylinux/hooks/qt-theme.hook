#!/bin/sh
set -e
# Normally we bundle qt6ct to allow custom theming so this hook is not needed
# WARNING: The '-stylesheet' flag is NOT supported by all Qt apps!
# So verify that it works before using this hook!

# USAGE: Set the env variable APPIMAGE_QT_THEME
# or make a .stylesheet file next to the appimage (appimagename + .stylesheet)

# check if there is a custom stylesheet and append it to the arrray
if [ -f "$APPIMAGE".stylesheet ]; then
	APPIMAGE_QT_THEME="$APPIMAGE.stylesheet"
fi
if [ -f "$APPIMAGE_QT_THEME" ]; then
	set -- "$@" "-stylesheet" "$APPIMAGE_QT_THEME"
fi
