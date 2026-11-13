#!/bin/sh
set -e
# Helper script in POSIX shell to install udev rules

# checks if the bundled udev rules are installed, checks in multiple places
# to make sure they were not installed by other means, then informs the user
# that the udev rules need to be installed, then it will
# use pkexec or lxqt-sudo to gain rights to install them
# at /usr/local/lib/udev

# Note this will only install udev rules, nothing else, some rules require the
# user to be in a group, in that case you will need to change this script

_disable_udev=$CACHEDIR/.${APPIMAGE##*/}-udev-check-disabled
_udev_install_msg="${APPIMAGE##*/} needs udev rules in order to work. Do you wish to install them?"

# make sure we have the needed deps
_udev_installer_check() {
	if [ "$CI" = 'true' ]; then
		return 1
	elif [ -f "$_disable_udev" ] || [ -z "$APPDIR" ] || [ -z "$APPIMAGE" ]; then
		return 1
	elif ! is_cmd cp mkdir; then
		return 1
	elif ! run_gui_sudo --check; then
		return 1
	fi

	for d in "$APPDIR"/etc/udev/rules.d "$APPDIR"/lib/udev/rules.d; do
		if [ -d "$d" ]; then
			_bundled_udev_rules=$d
			return 0
		fi
	done

	return 1
}

_is_rule_already_installed() {
	# Add any possible udev files in the array
	set -- "$_bundled_udev_rules"/*

	# check if it is already installed on the host, check in multiple
	# places since they could be installed by distro or other means
	for f do
		if [ -f /etc/udev/rules.d/"${f##*/}" ] \
		  || [ -f /usr/lib/udev/rules.d/"${f##*/}" ] \
		  || [ -f /usr/local/lib/udev/rules.d/"${f##*/}" ]; then
			shift
		fi
	done

	# bundled udev rules are already installed if the array is empty
	[ -n "$1" ] || return 1
}

_install_udev() {
	# due to some weird issue I noticed in kubuntu, we do not have
	# permission to copy the dir from the FUSE filesystem to /usr/local
	# we need to instead copy the dir first to /tmp and then
	# copy it over to /usr/local...

	# just in case there is something funny there already
	_tmp_udev_dir=${TMPDIR:-/tmp}/.tmp-udev-rules-${APPDIR##*/}
	rm -rf "$_tmp_udev_dir"
	mkdir -p "$_tmp_udev_dir"
	cp -rv "$_bundled_udev_rules"/* "$_tmp_udev_dir"

	run_gui_sudo /bin/sh -c "
	  mkdir -p /usr/local/lib/udev/rules.d
	  cp -v '$_tmp_udev_dir'/* /usr/local/lib/udev/rules.d
	  command -v udevadm && udevadm control --reload-rules
	"
	notify "udev rules successfully installed!"
}

install_udev_rules() {
	_udev_installer_check || return 0
	_is_rule_already_installed || return 0
	if notify --display-question "$_udev_install_msg"; then
		_install_udev
	else
		if notify -dq "Do you wish to not see this message again?"; then
			mkdir -p "$CACHEDIR"
			:> "$_disable_udev"
		fi
	fi
}

install_udev_rules || :
