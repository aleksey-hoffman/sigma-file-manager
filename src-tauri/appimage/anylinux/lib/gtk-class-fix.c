/*
 * GTK Window Class Override
 * ===================================================
 *
 * PURPOSE:
 *  GNOME made the window class of applications different between x11 and
 *  wayland, breaking desktop integration of appimages as result.
 *
 * USAGE:
 *   GTK_WINDOW_CLASS=fuck.gnome LD_PRELOAD=./gtk-class-fix.so /path/to/app
 *
 * WARNING:
 *  This was 100% vibed with AI by someone that has no idea about C
 *  It works, but no idea if this can cause weird issues down the line
*/

#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>

/* ------------------------------------------------------------------ */
/*  GTK / GLib window-class overrides                                 */
/* ------------------------------------------------------------------ */

typedef struct _GApplication GApplication;
typedef unsigned int GApplicationFlags;

static const char *override_id = NULL;

static GApplication *(*real_g_application_new)(const char *, GApplicationFlags);
static GApplication *(*real_gtk_application_new)(const char *, GApplicationFlags);
static void (*real_g_application_set_application_id)(GApplication *, const char *);
static const char *(*real_g_application_get_application_id)(GApplication *);
static void (*real_g_set_prgname)(const char *);
static const char *(*real_g_get_prgname)(void);
static void (*real_gdk_surface_set_app_id)(void *surface, const char *app_id);
static void (*real_gdk_wayland_window_set_app_id)(void *window, const char *app_id);
static void (*real_gdk_window_set_app_id)(void *window, const char *app_id);

static int gtk_init_done = 0;

static void gtk_init(void) {
	if (__atomic_load_n(&gtk_init_done, __ATOMIC_ACQUIRE)) return;

	override_id = getenv("GTK_WINDOW_CLASS");
	if (override_id && *override_id) {
		fprintf(stderr, " [gtk-class-fix.so] Setting window class to '%s'\n", override_id);
	} else {
		override_id = NULL;
	}

	real_g_application_new = dlsym(RTLD_NEXT, "g_application_new");
	real_gtk_application_new = dlsym(RTLD_NEXT, "gtk_application_new");
	real_g_application_set_application_id = dlsym(RTLD_NEXT, "g_application_set_application_id");
	real_g_application_get_application_id = dlsym(RTLD_NEXT, "g_application_get_application_id");
	real_g_set_prgname = dlsym(RTLD_NEXT, "g_set_prgname");
	real_g_get_prgname = dlsym(RTLD_NEXT, "g_get_prgname");
	real_gdk_surface_set_app_id = dlsym(RTLD_NEXT, "gdk_surface_set_app_id");
	real_gdk_wayland_window_set_app_id = dlsym(RTLD_NEXT, "gdk_wayland_window_set_app_id");
	real_gdk_window_set_app_id = dlsym(RTLD_NEXT, "gdk_window_set_app_id");
	__atomic_store_n(&gtk_init_done, 1, __ATOMIC_RELEASE);
}

static const char *effective_id(const char *requested) {
	return override_id ? override_id : requested;
}

GApplication *g_application_new(const char *application_id, GApplicationFlags flags) {
	gtk_init();
	return real_g_application_new ? real_g_application_new(effective_id(application_id), flags) : NULL;
}

GApplication *gtk_application_new(const char *application_id, GApplicationFlags flags) {
	gtk_init();
	return real_gtk_application_new ? real_gtk_application_new(effective_id(application_id), flags) : NULL;
}

void g_application_set_application_id(GApplication *app, const char *application_id) {
	gtk_init();
	if (real_g_application_set_application_id) {
		real_g_application_set_application_id(app, effective_id(application_id));
	}
}

void g_set_prgname(const char *prgname) {
	gtk_init();
	if (real_g_set_prgname) {
		real_g_set_prgname(effective_id(prgname));
	}
}

const char *g_application_get_application_id(GApplication *app) {
	gtk_init();
	if (override_id) return override_id;
	return real_g_application_get_application_id ? real_g_application_get_application_id(app) : NULL;
}

const char *g_get_prgname(void) {
	gtk_init();
	if (override_id) return override_id;
	return real_g_get_prgname ? real_g_get_prgname() : NULL;
}

void gdk_surface_set_app_id(void *surface, const char *app_id) {
	gtk_init();
	if (real_gdk_surface_set_app_id) {
		real_gdk_surface_set_app_id(surface, effective_id(app_id));
	}
}

void gdk_wayland_window_set_app_id(void *window, const char *app_id) {
	gtk_init();
	if (real_gdk_wayland_window_set_app_id) {
		real_gdk_wayland_window_set_app_id(window, effective_id(app_id));
	}
}

void gdk_window_set_app_id(void *window, const char *app_id) {
	gtk_init();
	if (real_gdk_window_set_app_id) {
		real_gdk_window_set_app_id(window, effective_id(app_id));
	}
}

/* ------------------------------------------------------------------ */
/*  Constructor                                                       */
/* ------------------------------------------------------------------ */

__attribute__((constructor))
static void gtk_class_fix_ctor(void) {
	gtk_init();
	if (override_id && real_g_set_prgname) {
		real_g_set_prgname(override_id);
	}
}
