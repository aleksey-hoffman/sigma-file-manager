#!/bin/sh
set -e
# this hook allows attempting to use the host libjack.so
# jack has a big issue that clients and servers need to be using the same
# libjack.so to guarantee functionality
#
# flatpak and similar solve this issue by using pipewire-jack
# which provides a drop in replacement of libjack.so that does not have this
# limitation of needing matching library versions between clients and server
#
# however pipewirejack often has performance issues that real libjack does not
# have,so it is good to at least attempt to use the host libjack if needed
#
# https://gitlab.com/freedesktop-sdk/freedesktop-sdk/-/issues/1001#note_323464727
# https://github.com/flatpak/flatpak/issues/1509#issuecomment-3315750411
# https://discourse.ardour.org/t/ardour-pipewire-sound-stuttering-crackling-popping-when-adjusting-system-volume/109054/3

# hook is enabled by default
USE_HOST_LIBJACK=${USE_HOST_LIBJACK:-1}

_find_host_libjack() (
	if [ ! -d "$HOST_LIBJACK_DIR" ]; then
		# attempt to find where the host libjack is located
		while read -r d; do
			set -- "$d"/libjack.so*
			if [ ! -f "$1" ]; then
				continue
			# skip libjack if it links to pipewire since that is
			# pipewirejack and there is no point in trying to use it
			elif grep -aq 'libpipewire' "$1"; then
				continue
			else
				mkdir -p "$HOST_LIBJACK_DIR"
				cp -L "$d"/libjack.so* "$HOST_LIBJACK_DIR"
				return 0
			fi
		done <<-EOF
		/usr/lib/$APPIMAGE_ARCH-linux-gnu
		/usr/lib64
		/usr/lib
		EOF
	else
		return 0
	fi
	return 1
)

if [ "$USE_HOST_LIBJACK" = 1 ]; then
	HOST_LIBJACK_DIR=${HOST_LIBJACK_DIR:-${TMPDIR:-/tmp}/.hostlibjack}

	if _find_host_libjack; then
		export SHARUN_EXTRA_LIBRARY_PATH="${HOST_LIBJACK_DIR}${SHARUN_EXTRA_LIBRARY_PATH:+:$SHARUN_EXTRA_LIBRARY_PATH}"
	else
		err_msg ""
		err_msg "host-libjack: ERROR: libjack.so not found on this system"
		err_msg "or it is pipewire-jack, which is not useful here. Aborting..."
		err_msg ""
	fi
fi
