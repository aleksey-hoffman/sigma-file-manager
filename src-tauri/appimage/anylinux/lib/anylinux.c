/* Modified version of
 * https://github.com/darealshinji/linuxdeploy-plugin-checkrt/blob/master/exec.c
 * Unsets known variables that cause issues rather than restoring to parent enviroment
 * One issue with restoring to the parent enviroment is that it unset variables set by
 * terminal emulators like TERM which need to be preserved in the child shell
 *
 * This library also fixes a common issue when appimage portable home, config, etc
 * mode is used, where for example the HOME var from the portable .home dir would
 * be inherited by other processes launched by the appimage in portable mode
 * causing them to start using the fake .home dir instead of the real home
 *
 * It also offers the option to change argv0 of the running binary
 *
 * It also offers the ability to block specific libraries from being loaded via dlopen
 * by setting ANYLINUX_DO_NOT_LOAD_LIBS to a colon-separated list of glob patterns
 *
 * It also overrides __nss_configure_lookup to prevent glibc from dlopening
 * nss libs that are not bundled in the AppImage
 *
 * It also overrides bindtextdomain calls to /usr/share/locale to TEXTDOMAINDIR
 * which sharun automatically sets to our bundled locale dir
 *
 * It also makes sure $APPDIR/bin is always present in PATH, since apps
 * may clear their own environ before executing a helper binary
*/

#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include <dlfcn.h>
#include <fnmatch.h>
#include <limits.h>
#include <locale.h>
#include <spawn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/param.h>
#include <sys/types.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>

typedef int (*execve_func_t)(const char *filename, char *const argv[], char *const envp[]);
typedef int (*posix_spawn_func_t)(pid_t *pid, const char *path,
		const posix_spawn_file_actions_t *file_actions,
		const posix_spawnattr_t *attrp, char *const argv[],
		char *const envp[]);
typedef void *(*dlopen_func_t)(const char *filename, int flags);

#define VISIBLE __attribute__ ((visibility ("default")))

// print to stderr when ANYLINUX_LIB_DEBUG=1
static int appimage_exec_debug_enabled(void) {
	const char *v = getenv("ANYLINUX_LIB_DEBUG");
	return v && strcmp(v, "1") == 0;
}

#define DEBUG_PRINT(...) do \
	if (appimage_exec_debug_enabled()) \
		fprintf(stderr, " [anylinux.so] >> " __VA_ARGS__); \
	while (0)

// Override the name of the running program
__attribute__((constructor))
static void spoof_argv0(int argc, char **argv) {
	const char *new_argv0 = getenv("OVERRIDE_ARGV0");
	if (new_argv0 && *new_argv0) {
		DEBUG_PRINT("Overriding argv[0] from '%s' to '%s'\n", argv[0], new_argv0);
		argv[0] = (char *)new_argv0;
		unsetenv("OVERRIDE_ARGV0");
	}
}

// Capture APPDIR and PATH at load time (before this process clears its own
// environ). Programs may call clearenv() + set specific vars before execvpe,
// which strips PATH. Without PATH the executable lookup falls back to
// glibc's _CS_PATH (/bin:/usr/bin), skipping AppImage bin dirs and failing.
// Since _CS_PATH is an intra-libcall it can't be overridden via LD_PRELOAD,
// we save both here and construct a PATH with APPDIR/bin first at exec time.
static char saved_appdir[PATH_MAX] = "";
static char saved_path[PATH_MAX] = "";

__attribute__((constructor))
static void capture_appdir_and_path(void) {
	const char *a = getenv("APPDIR");
	if (a)
		strncpy(saved_appdir, a, sizeof(saved_appdir) - 1);
	const char *p = getenv("PATH");
	if (p)
		strncpy(saved_path, p, sizeof(saved_path) - 1);
}

// Fix host locale issues; mirrors the locale-check logic previously in AppRun-generic
__attribute__((constructor))
static void init_locale(void) {
	if (setlocale(LC_ALL, "")) {
		DEBUG_PRINT("Host locale is valid\n");
		return;
	}
	DEBUG_PRINT("Host locale is broken; attempting to fix\n");

	// Check setting LOCPATH to /usr/share/locale first
	// see: https://github.com/pkgforge-dev/Anylinux-AppImages/issues/615#issuecomment-4533427173
	setenv("LOCPATH", "/usr/share/locale", 1);
	if (setlocale(LC_ALL, "")) {
		DEBUG_PRINT("Locale fixed via LOCPATH to /usr/share/locale\n");
		return;
	}

	// set LOCPATH to our bundled locales
	const char *appdir = getenv("APPDIR");
	if (appdir && *appdir) {
		char lcdir[PATH_MAX];
		snprintf(lcdir, sizeof(lcdir), "%s/shared/lib/locale", appdir);
		setenv("LOCPATH", lcdir, 1);
		if (setlocale(LC_ALL, "")) {
			DEBUG_PRINT("Locale fixed via LOCPATH to bundled locales\n");
			return;
		}
	}

	// Fallback chain: try progressively simpler locales
	const char *fallbacks[] = { "en_US.UTF-8", "C.UTF-8", "C", NULL };
	const char **fb;
	for (fb = fallbacks; *fb; fb++) {
		DEBUG_PRINT("Trying LC_ALL=%s\n", *fb);
		setenv("LC_ALL", *fb, 1);
		if (setlocale(LC_ALL, "")) {
			DEBUG_PRINT("Locale fixed via fallback to LC_ALL=%s\n", *fb);
			return;
		}
	}

	// Should never reach here since "C" always works, but be safe
	DEBUG_PRINT("All locale fallbacks exhausted, this is impossible!\n");
}

// Redirect bindtextdomain calls to our locale, TEXTDOMAINDIR is set by sharun
// We only do it for calls that point to /usr/share/locale, some apps may have
// additional locales in in different locations, in those cases we do not intercept
typedef char *(*bindtextdomain_t)(const char *, const char *);
static bindtextdomain_t real_bindtextdomain;
static const char *override_textdomaindir;

__attribute__((constructor))
static void init_bindtextdomain_override(void) {
	real_bindtextdomain = (bindtextdomain_t)dlsym(RTLD_NEXT, "bindtextdomain");
	override_textdomaindir = getenv("TEXTDOMAINDIR");
}

VISIBLE char *bindtextdomain(const char *domainname, const char *dirname) {
	const char *use_dir = dirname;
	if (dirname && strcmp(dirname, "/usr/share/locale") == 0) {
		if (override_textdomaindir && *override_textdomaindir) {
			use_dir = override_textdomaindir;
			DEBUG_PRINT("Overriding bindtextdomain call to %s -> %s\n", dirname, use_dir);
		}
	}
	// Also override any dirs that start with /tmp since quick-sharun
	// will patch hardcoded paths from /usr/share to /tmp/XXXXX
	else if (dirname && strncmp(dirname, "/tmp", 4) == 0) {
		if (override_textdomaindir && *override_textdomaindir) {
			use_dir = override_textdomaindir;
			DEBUG_PRINT("Overriding bindtextdomain call to (%s) -> %s\n", dirname, use_dir);
		}
	}
	return real_bindtextdomain ? real_bindtextdomain(domainname, use_dir) : NULL;
}

// Check if a library should be blocked from loading via dlopen
static int should_block_library(const char *filename) {
	if (!filename) return 0;

	const char *blocklist = getenv("ANYLINUX_DO_NOT_LOAD_LIBS");
	if (!blocklist || !*blocklist) return 0;

	// Extract the basename from the filename for matching
	const char *basename = strrchr(filename, '/');
	basename = basename ? basename + 1 : filename;

	// Make a mutable copy of the blocklist to tokenize
	char *list_copy = strdup(blocklist);
	if (!list_copy) return 0;

	int blocked = 0;
	char *saveptr = NULL;
	char *token = strtok_r(list_copy, ":", &saveptr);
	while (token) {
		// Skip empty tokens (e.g. from "lib1::lib2")
		if (*token) {
			// Match against both the full path and the basename
			if (fnmatch(token, basename, 0) == 0 || fnmatch(token, filename, 0) == 0) {
				blocked = 1;
				break;
			}
		}
		token = strtok_r(NULL, ":", &saveptr);
	}

	free(list_copy);
	return blocked;
}

// problematic vars to check
static const char* vars_to_unset[] = {
	"ALSA_CONFIG_PATH",
	"BABL_PATH",
	"__EGL_VENDOR_LIBRARY_DIRS",
	"__EGL_VENDOR_LIBRARY_FILENAMES",
	"FOLKS_BACKEND_PATH",
	"FREI0R_PATH",
	"GBM_BACKENDS_PATH",
	"GCONV_PATH",
	"GDK_PIXBUF_MODULEDIR",
	"GDK_PIXBUF_MODULE_FILE",
	"GEGL_PATH",
	"GIO_MODULE_DIR",
	"GI_TYPELIB_PATH",
	"GSETTINGS_SCHEMA_DIR",
	"GS_LIB",
	"GST_PLUGIN_PATH",
	"GST_PLUGIN_SCANNER",
	"GST_PLUGIN_SYSTEM_PATH",
	"GST_PLUGIN_SYSTEM_PATH_1_0",
	"GTK_DATA_PREFIX",
	"GTK_EXE_PREFIX",
	"GTK_IM_MODULE_FILE",
	"GTK_PATH",
	"IMLIB2_FILTER_PATH",
	"IMLIB2_LOADER_PATH",
	"JACK_DRIVER_DIR",
	"LADSPA_PATH",
	"LD_LIBRARY_PATH",
	"LD_PRELOAD",
	"LIBDECOR_PLUGIN_DIR",
	"LIBGL_DRIVERS_PATH",
	"LIBHEIF_PLUGIN_PATH",
	"LIBVA_DRIVERS_PATH",
	"LOCPATH",
	"MAGIC",
	"MAGICK_CODER_FILTER_PATH",
	"MAGICK_CODER_MODULE_PATH",
	"MAGICK_CONFIGURE_PATH",
	"MAGICK_HOME",
	"MLT_PRESETS_PATH",
	"MLT_PROFILES_PATH",
	"MLT_REPOSITORY",
	"OPENSSL_CONF",
	"PERLLIB",
	"PIPEWIRE_CONFIG_DIR",
	"PIPEWIRE_MODULE_DIR",
	"PYTHONHOME",
	"QT_PLUGIN_PATH",
	"SPA_PLUGIN_DIR",
	"TCL_LIBRARY",
	"TEXTDOMAINDIR",
	"TK_LIBRARY",
	"VK_DRIVER_FILES",
	"WEBKIT_EXEC_PATH",
	"WEBKIT_INJECTED_BUNDLE_PATH",
	"QT_XKB_CONFIG_ROOT",
	"XKB_CONFIG_ROOT",
	"XTABLES_LIBDIR",
	NULL
};

static char* const* create_cleaned_env(char* const* original_env) {
	const char *appdir = getenv("APPDIR");
	if (!appdir) {
		DEBUG_PRINT("APPDIR is NOT set!\n");
		return original_env;
	}
	DEBUG_PRINT("APPDIR is set: %s\n", appdir);

	size_t env_count = 0;
	while (original_env[env_count] != NULL)
		env_count++;

	char** new_env = calloc(env_count + 1, sizeof(char*));
	size_t new_env_index = 0;

	for (size_t i = 0; i < env_count; i++) {
		int should_copy = 1;
		// check if this is a variable we should potentially unset
		for (const char** var = vars_to_unset; *var != NULL; var++) {
			size_t var_len = strlen(*var);
			if (strncmp(original_env[i], *var, var_len) == 0 && original_env[i][var_len] == '=') {
				const char* value = original_env[i] + var_len + 1;
				// unset if the value contains APPDIR
				if (strstr(value, appdir) != NULL) {
					DEBUG_PRINT("Unset %s (value: %s)\n", *var, value);
					should_copy = 0;
					break;
				}
				// Also unset LD_PRELOAD if it contains anylinux.so
				// since this variable can contain the lib name only without APPDIR path
				if (strcmp(*var, "LD_PRELOAD") == 0 &&
				    strstr(value, "anylinux.so") != NULL) {
					DEBUG_PRINT("Unset LD_PRELOAD containing anylinux.so (value: %s)\n", value);
					should_copy = 0;
					break;
				}
			}
		}
		if (should_copy) {
			new_env[new_env_index] = strdup(original_env[i]);
			new_env_index++;
		}
	}

	new_env[new_env_index] = NULL;
	DEBUG_PRINT("Child environment has %zu variables (Parent %zu)\n", new_env_index, env_count);
	return new_env;
}

static void env_free(char* const *env) {
	if (!env) return;
	for (size_t i = 0; env[i] != NULL; i++)
		free(env[i]);
	free((char**)env);
}

static int is_external_process(const char *filename) {
	const char *appdir = getenv("APPDIR");
	if (!appdir) {
		DEBUG_PRINT("APPDIR not set; treating %s as internal process\n", filename);
		return 0;
	}

	int external = (strncmp(filename, appdir, MIN(strlen(filename), strlen(appdir))) != 0);
	DEBUG_PRINT("Process '%s' is %s (APPDIR=%s)\n", filename, external ? "EXTERNAL" : "INTERNAL", appdir);
	return external;
}

static void restore_portable_dirs(void) {
	const char *real_data = getenv("REAL_XDG_DATA_HOME");
	if (real_data && *real_data) {
		if (setenv("XDG_DATA_HOME", real_data, 1) == 0)
			DEBUG_PRINT("Restored XDG_DATA_HOME to %s\n", real_data);
		else
			DEBUG_PRINT("Failed to restore XDG_DATA_HOME to %s\n", real_data);
	}

	const char *real_config = getenv("REAL_XDG_CONFIG_HOME");
	if (real_config && *real_config) {
		if (setenv("XDG_CONFIG_HOME", real_config, 1) == 0)
			DEBUG_PRINT("Restored XDG_CONFIG_HOME to %s\n", real_config);
		else
			DEBUG_PRINT("Failed to restore XDG_CONFIG_HOME to %s\n", real_config);
	}

	const char *real_cache = getenv("REAL_XDG_CACHE_HOME");
	if (real_cache && *real_cache) {
		if (setenv("XDG_CACHE_HOME", real_cache, 1) == 0)
			DEBUG_PRINT("Restored XDG_CACHE_HOME to %s\n", real_cache);
		else
			DEBUG_PRINT("Failed to restore XDG_CACHE_HOME to %s\n", real_cache);
	}

	// we always set XDG_CACHE_HOME to a new location to prevent conflicts with
	// the host cache, restore XDG_CACHE_HOME to the original value
	const char *use_host_cache = getenv("USE_HOST_XDG_CACHE_HOME");
	if (!use_host_cache || strcmp(use_host_cache, "1") != 0) {
		const char *host_cache = getenv("HOST_XDG_CACHE_HOME");
		if (host_cache && *host_cache) {
			if (setenv("XDG_CACHE_HOME", host_cache, 1) == 0)
				DEBUG_PRINT("Restored XDG_CACHE_HOME to %s (from HOST_XDG_CACHE_HOME)\n", host_cache);
			else
				DEBUG_PRINT("Failed to restore XDG_CACHE_HOME to %s (from HOST_XDG_CACHE_HOME)\n", host_cache);
		}
	}

	const char *real_home = getenv("REAL_HOME");
	if (real_home && *real_home) {
		if (setenv("HOME", real_home, 1) == 0)
			DEBUG_PRINT("Restored HOME to %s\n", real_home);
		else
			DEBUG_PRINT("Failed to restore HOME to %s\n", real_home);
	}
}

static int spawn_common(posix_spawn_func_t fn,
						const char *path, pid_t *pid,
						const posix_spawn_file_actions_t *file_actions,
						const posix_spawnattr_t *attrp,
						char *const argv[], char *const envp[])
{
	char *fullpath = canonicalize_file_name(path);
	const char *path_to_check = fullpath ? fullpath : path;

	char *const *env = envp;
	if (is_external_process(path_to_check)) {
		DEBUG_PRINT("External process detected; cleaning environment\n");
		env = create_cleaned_env(envp);

		if (!env) {
			DEBUG_PRINT("Error creating cleaned environment; using original env\n");
			env = envp;
		}
	}

	int ret = fn(pid, path, file_actions, attrp, argv, env);

	if (env != envp)
		env_free(env);
	free(fullpath);

	return ret;
}

static int exec_common(execve_func_t function, const char *filename, char* const argv[], char* const envp[]) {
	DEBUG_PRINT("Preparing to exec: %s\n", filename);

	char *fullpath = canonicalize_file_name(filename);
	DEBUG_PRINT("canonicalize file: %s -> %s\n", filename, fullpath ? fullpath : "(null)");

	// always unset LD_DEBUG to child processes to help when
	// troubleshooting with APPIMAGE_DEBUG=1
	unsetenv("LD_DEBUG");

	// remove problematic variables
	char* const *env = envp;
	const char* path_to_check = fullpath ? fullpath : filename;
	if (is_external_process(path_to_check)) {
		DEBUG_PRINT("External process detected; cleaning environment\n");

		restore_portable_dirs();

		env = create_cleaned_env(envp);
		if (!env) {
			DEBUG_PRINT("Error creating cleaned environment; using original env\n");
			env = envp;
		}
	} else {
		const char *basename = strrchr(filename, '/');
		basename = basename ? basename + 1 : filename;
		if (strcmp(basename, "xdg-open") == 0 || strcmp(basename, "gio-launch-desktop") == 0) {
			DEBUG_PRINT("Internal process detected (%s); cleaning environment anyway since this is needed\n", basename);

			restore_portable_dirs();

			env = create_cleaned_env(envp);
			if (!env) {
				DEBUG_PRINT("Error creating cleaned environment; using original env\n");
				env = envp;
			}
		} else
			DEBUG_PRINT("Internal process; leaving environment unchanged\n");
	}

	// Ensure PATH is always present at exec time. Process may have already cleared environ.
	// glibc's execvpe(3) reads PATH via getenv() from the current process's environ,
	// NOT from the envp parameter — so injecting into envp is not enough. We must also
	// setenv() in the current process so that the fallback PATH search works correctly.
	if (saved_appdir[0]) {
		int has_path = 0;
		for (size_t i = 0; env[i]; i++) {
			if (strncmp(env[i], "PATH=", 5) == 0 && env[i][5] != '\0') {
				has_path = 1;
				break;
			}
		}
		if (!has_path) {
			char path_buf[sizeof(saved_appdir) + sizeof(saved_path) + 10];
			snprintf(path_buf, sizeof(path_buf),
				 "PATH=%s/bin:%s", saved_appdir,
				 saved_path[0] ? saved_path : "/usr/bin:/bin");

			// Inject into envp array for execve(2) (which reads from envp)
			size_t count = 0;
			while (env[count]) count++;

			char **new_env = calloc(count + 2, sizeof(char*));
			if (new_env) {
				for (size_t i = 0; i < count; i++)
					new_env[i] = strdup(env[i]);

				new_env[count] = strdup(path_buf);
				new_env[count + 1] = NULL;

				if (env != envp)
					env_free(env);
				env = (char* const *)new_env;
			}

			// Also set into environ so glibc's getenv("PATH") inside execvpe finds it
			setenv("PATH", path_buf + 5, 1);
			DEBUG_PRINT("Restored PATH to include APPDIR/bin\n");
		}
	}

	DEBUG_PRINT("Calling exec for %s\n", filename);
	int ret = function(filename, argv, env);

	if (ret == -1) DEBUG_PRINT("Underlying exec returned -1, errno=%d (%s)\n", errno, strerror(errno));
	if (fullpath && fullpath != filename) free(fullpath);
	if (env != envp) env_free(env);

	return ret;
}

VISIBLE int execve(const char *filename, char *const argv[], char *const envp[]) {
	DEBUG_PRINT("execve call hijacked: %s\n", filename);
	execve_func_t execve_orig = dlsym(RTLD_NEXT, "execve");
	if (!execve_orig) {
		DEBUG_PRINT("Error getting original execve symbol: %s\n", dlerror());
		errno = ENOSYS;
		return -1;
	}
	return exec_common(execve_orig, filename, argv, envp);
}

VISIBLE int execv(const char *filename, char *const argv[]) {
	DEBUG_PRINT("execv call hijacked: %s\n", filename);
	return execve(filename, argv, environ);
}

VISIBLE int execvpe(const char *filename, char *const argv[], char *const envp[]) {
	DEBUG_PRINT("execvpe hijacked: %s\n", filename);
	execve_func_t execvpe_orig = dlsym(RTLD_NEXT, "execvpe");
	if (!execvpe_orig) {
		DEBUG_PRINT("Error getting original execvpe symbol: %s\n", dlerror());
		errno = ENOSYS;
		return -1;
	}
	return exec_common(execvpe_orig, filename, argv, envp);
}

VISIBLE int execvp(const char *filename, char *const argv[]) {
	DEBUG_PRINT("execvp hijacked: %s\n", filename);
	return execvpe(filename, argv, environ);
}

VISIBLE int posix_spawn(pid_t *pid, const char *path,
		const posix_spawn_file_actions_t *file_actions,
		const posix_spawnattr_t *attrp, char *const argv[],
		char *const envp[]) {
	DEBUG_PRINT("posix_spawn call hijacked: %s\n", path);
	posix_spawn_func_t fn = dlsym(RTLD_NEXT, "posix_spawn");
	if (!fn)
		return ENOSYS;

	return spawn_common(fn, path, pid, file_actions, attrp, argv, envp);
}

VISIBLE int posix_spawnp(pid_t *pid, const char *file,
		const posix_spawn_file_actions_t *file_actions,
		const posix_spawnattr_t *attrp, char *const argv[],
		char *const envp[]) {
	DEBUG_PRINT("posix_spawnp call hijacked: %s\n", file);
	posix_spawn_func_t fn = dlsym(RTLD_NEXT, "posix_spawnp");
	if (!fn)
		return ENOSYS;

	return spawn_common(fn, file, pid, file_actions, attrp, argv, envp);
}

// Force NSS to only use the modules we bundle. Without this, glibc reads the
// host /etc/nsswitch.conf at runtime and may try to dlopen NSS modules
// (libnss_mdns4_minimal.so.2) that are not in the AppImage causing crashes.
//
// Use "files" for user/group/shadow lookups and "files dns" for host resolution.
// These correspond to libnss_files.so and libnss_dns.so, bundled by glibc deployment.
__attribute__((constructor(101)))
static void init_nssfix(void) {
	typedef int (*nss_configure_fn)(const char *, const char *);

	nss_configure_fn nss_configure_lookup = (nss_configure_fn)dlsym(RTLD_DEFAULT, "__nss_configure_lookup");

	if (!nss_configure_lookup) {
		DEBUG_PRINT("nssfix: __nss_configure_lookup not found, skipping\n");
		return;
	}

	static const struct {
		const char *dbname;
		const char *service_line;
	} nss_overrides[] = {
		{ "aliases",    "files" },
		{ "ethers",     "files" },
		{ "group",      "files" },
		{ "gshadow",    "files" },
		{ "hosts",      "files dns" },
		{ "initgroups", "files" },
		{ "netgroup",   "files" },
		{ "networks",   "files" },
		{ "passwd",     "files" },
		{ "protocols",  "files" },
		{ "publickey",  "files" },
		{ "rpc",        "files" },
		{ "services",   "files" },
		{ "shadow",     "files" },
		{ NULL, NULL }
	};

	for (size_t i = 0; nss_overrides[i].dbname; i++) {
		int rc = nss_configure_lookup(
			nss_overrides[i].dbname,
			nss_overrides[i].service_line);
		if (rc != 0) {
			DEBUG_PRINT("nssfix: \"%s\" -> \"%s\" FAILED\n",
				    nss_overrides[i].dbname,
				    nss_overrides[i].service_line);
		}
	}
	DEBUG_PRINT("nssfix: Ignoring host nsswitch.conf, using only files+dns\n");
}

// Intercept dlopen to block loading of specific libraries
VISIBLE void *dlopen(const char *filename, int flags) {
	dlopen_func_t dlopen_orig = dlsym(RTLD_NEXT, "dlopen");
	if (!dlopen_orig) {
		DEBUG_PRINT("Error getting original dlopen symbol: %s\n", dlerror());
		return NULL;
	}

	// NULL filename means the caller wants a handle to the main program
	if (filename && should_block_library(filename)) {
		DEBUG_PRINT("Blocked dlopen of '%s' (matched ANYLINUX_DO_NOT_LOAD_LIBS)\n", filename);
		// We must make dlerror() return a proper error string after returning NULL
		// If dlerror() returns NULL here the caller will segfault on the string format.
		// Trigger a real dlopen failure so the dynamic linker sets the error state.
		(void)dlopen_orig("/anylinux_blocked_lib_that_does_not_exist.so", RTLD_NOW);
		return NULL;
	}

	DEBUG_PRINT("dlopen pass-through: %s\n", filename ? filename : "(NULL)");
	return dlopen_orig(filename, flags);
}
