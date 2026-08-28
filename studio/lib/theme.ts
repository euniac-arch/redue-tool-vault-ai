export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'redue-theme';
export const ADMIN_THEME_STORAGE_KEY = 'admin-theme';
export const DEFAULT_THEME: Theme = 'dark';
export const ADMIN_DEFAULT_THEME: Theme = 'light';

export const isAdminPathname = (pathname: string | null | undefined): boolean =>
	pathname === '/admin' || !!pathname?.startsWith('/admin/');

export function themeStorageKey(isAdmin: boolean): string {
	return isAdmin ? ADMIN_THEME_STORAGE_KEY : THEME_STORAGE_KEY;
}

/**
 * Runs before paint so the first frame matches the stored preference (no FOUC).
 * Public routes use `redue-theme` (default dark). `/admin/*` uses `admin-theme` (default light).
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;var p=location.pathname;var isAdmin=p==='/admin'||p.indexOf('/admin/')===0;try{var t=localStorage.getItem(isAdmin?'${ADMIN_THEME_STORAGE_KEY}':'${THEME_STORAGE_KEY}');var dark=isAdmin?t==='dark':t!=='light';if(dark){d.classList.add('dark');d.style.colorScheme='dark';}else{d.classList.remove('dark');d.style.colorScheme='light';}}catch(e){if(isAdmin){d.classList.remove('dark');d.style.colorScheme='light';}else{d.classList.add('dark');d.style.colorScheme='dark';}}})();`;

export function applyThemeClass(theme: Theme) {
	const root = document.documentElement;
	if (theme === 'dark') {
		root.classList.add('dark');
		root.style.colorScheme = 'dark';
	} else {
		root.classList.remove('dark');
		root.style.colorScheme = 'light';
	}
}

export function resolveAppliedTheme(): Theme {
	if (typeof document === 'undefined') return DEFAULT_THEME;
	return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function readStoredTheme(): Theme {
	try {
		return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : DEFAULT_THEME;
	} catch {
		return DEFAULT_THEME;
	}
}

export function persistTheme(theme: Theme) {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		/* private mode / blocked storage */
	}
}

export function readStoredAdminTheme(): Theme {
	try {
		return localStorage.getItem(ADMIN_THEME_STORAGE_KEY) === 'dark' ? 'dark' : ADMIN_DEFAULT_THEME;
	} catch {
		return ADMIN_DEFAULT_THEME;
	}
}

export function persistAdminTheme(theme: Theme) {
	try {
		localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
	} catch {
		/* private mode / blocked storage */
	}
}

export function readThemeForPath(isAdmin: boolean): Theme {
	return isAdmin ? readStoredAdminTheme() : readStoredTheme();
}

export function persistThemeForPath(isAdmin: boolean, theme: Theme) {
	if (isAdmin) persistAdminTheme(theme);
	else persistTheme(theme);
}
