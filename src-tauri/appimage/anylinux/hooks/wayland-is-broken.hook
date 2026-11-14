#!/bin/sh
set -e
# add this hook if the application you are using has known issues with wayland
# note that you need to check that indeed wayland is broken before adding this

if [ "$I_WANT_A_BROKEN_WAYLAND_UI" != 1 ]; then
	if [ "$XDG_SESSION_TYPE" = 'wayland' ]; then
		>&2 echo "Wayland is disabled due to known issues"
		>&2 echo "set I_WANT_A_BROKEN_WAYLAND_UI=1 if you still want to use it"
	fi
	export SDL_VIDEO_DRIVER=x11
	export QT_QPA_PLATFORM=xcb
	export GDK_BACKEND=x11
	export XDG_SESSION_TYPE=x11
	unset WAYLAND_DISPLAY
fi
