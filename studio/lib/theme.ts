export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'redue-theme';
export const DEFAULT_THEME: Theme = 'dark';

/** Runs before paint so the first frame matches the stored preference (no FOUC). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=document.documentElement;if(t==='light'){d.classList.remove('dark');d.style.colorScheme='light';}else{d.classList.add('dark');d.style.colorScheme='dark';}}catch(e){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}})();`;

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
