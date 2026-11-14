#!/bin/sh
set -e
# GNOME in their infinite wisdom decided that applications must provide their
# own window decorations on wayland, as result we would need to bundle
# 7 MiB of garbage in the AppImage just to "fix" this nonsense
#
# And those 7 MiB are best a case scenario when using the libdecor cairo
# plugin which looks horrible in GNOME anyway, way more with the gtk plugin...
#
# This is not a problem on Windows, macOS and the rest of linux including
# x11 GNOME, just utter nonsense from an organization that also tried
# to sabotage letting applications to draw their own icons???
# https://gitlab.freedesktop.org/wayland/wayland-protocols/-/merge_requests/269#note_2233724
#
# So instead lets try to use the host libdecor plugins, since libdecor
# should fail safe if anything goes wrong here, worst case scenario you wont
# have decorations in wayland which but the application will still work
#

_find_host_libdecor_plugins_dir() {
	# We only want to do this in GNOME Wayland, so check first
	case "$XDG_CURRENT_DESKTOP" in
		*GNOME*|*gnome*|*Gnome*) :;;
		*) return 0;;
	esac
	case "$XDG_SESSION_TYPE" in
		*Wayland*|*wayland*|*WAYLAND*) :;;
		*) return 0;;
	esac
	set -- \
	  /usr/lib/"$APPIMAGE_ARCH"-linux-gnu/libdecor/plugins-* \
	  /usr/lib64/libdecor/plugins-* \
	  /usr/lib/libdecor/plugins-* \
	  /nix/store/*/lib/libdecor/plugins-*
	for d do
		if [ -d "$d" ]; then
			export LIBDECOR_PLUGIN_DIR="$d"
			break
		fi
	done
}

if [ "$DO_NOT_USE_LIBDECOR_FFS" = 1 ] || [ -f "$APPDIR"/.disable-libdecor ]; then
	# set the var to a non existing location when not wanted
	# since libdecor may still try to load at its original prefix
	export LIBDECOR_PLUGIN_DIR=/XXX/YYY/ZZZ
	export SDL_VIDEO_WAYLAND_ALLOW_LIBDECOR=0
else
	_find_host_libdecor_plugins_dir
fi
