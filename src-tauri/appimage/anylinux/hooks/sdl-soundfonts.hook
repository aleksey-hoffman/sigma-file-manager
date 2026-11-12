#!/bin/sh
set -e
_deny_soundfonts_file=$CACHEDIR/.no-soundfont-${APPIMAGE##*/}
XDG_DATA_DIRS=$DATADIR:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}
export XDG_DATA_DIRS

_sound_font_src=https://deb.debian.org/debian/pool/main/f/fluid-soundfont/fluid-soundfont_3.1.orig.tar.gz
_sound_font_msg="${APPIMAGE##*/} requires a SoundFont to work properly. Do you wish to download FluidR3 SoundFont?"

_get_soundfont() (
	if [ -f "$_deny_soundfonts_file" ]; then
		return 1
	elif notify -dq "$_sound_font_msg"; then
		_dst=$DATADIR/soundfonts
		mkdir -p "$_dst"/.tmp
		cd "$_dst"/.tmp
		if download ./tmp.tar.gz "$_sound_font_src"; then
			tar xvf ./tmp.tar.gz
			mv -v ./*/*.sf2 "$_dst"
			rm -rf "$_dst"/.tmp
		else
			notify -de 'Something went wrong downloading SoundFont'
			return 1
		fi
	else
		mkdir -p "${_deny_soundfonts_file%/*}"
		:> "$_deny_soundfonts_file"
	fi
)

_find_soundfont() {
	set --
	_old_ifs=$IFS
	IFS=:
	for d in $XDG_DATA_DIRS; do
		set -- "$@" \
		  "$d"/soundfonts/*.sf2 \
		  "$d"/sounds/sf2/*.sf2 \
		  "$d"/soundfonts/*.sf3 \
		  "$d"/sounds/sf3/*.sf3
	done
	IFS=$_old_ifs

	for soundfont do
		if [ -f "$soundfont" ]; then
			SDL_SOUNDFONTS=${SDL_SOUNDFONTS:+$SDL_SOUNDFONTS:}$soundfont
		fi
	done

	if [ -n "$SDL_SOUNDFONTS" ]; then
		export SDL_SOUNDFONTS
	elif _get_soundfont; then
		_find_soundfont
	fi
}

if [ -z "$SDL_SOUNDFONTS" ]; then
	_find_soundfont
fi
