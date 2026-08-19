'use client';

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

type ThemeContextValue = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const resolveAppliedTheme = (): Theme => {
	if (typeof window === 'undefined') return 'dark';
	return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

const applyThemeClass = (next: Theme) => {
	if (typeof window === 'undefined') return;
	const root = document.documentElement;
	if (root.classList.contains('pdf-printing')) {
		root.classList.remove('dark');
		root.style.colorScheme = 'light';
		return;
	}
	if (next === 'dark') {
		root.classList.add('dark');
		root.style.colorScheme = 'dark';
	} else {
		root.classList.remove('dark');
		root.style.colorScheme = 'light';
	}
};

const readStoredTheme = (): Theme => {
	if (typeof window === 'undefined') return 'dark';
	try {
		const savedTheme = (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || 'dark';
		return savedTheme === 'light' ? 'light' : 'dark';
	} catch {
		return 'dark';
	}
};

const persistTheme = (next: Theme) => {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, next);
	} catch {
		/* private mode / blocked storage */
	}
};

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<Theme>(resolveAppliedTheme);
	const themeRef = useRef<Theme>(theme);
	themeRef.current = theme;

	useEffect(() => {
		const stored = readStoredTheme();
		themeRef.current = stored;
		setThemeState(stored);
		applyThemeClass(stored);

		const root = document.documentElement;
		let addedPdfPrintingForPrint = false;

		const applyPrintLight = () => {
			root.classList.add('pdf-printing');
			root.classList.remove('dark');
			root.style.colorScheme = 'light';
		};

		const syncClassToPreference = () => {
			if (root.classList.contains('pdf-printing')) {
				if (root.classList.contains('dark')) {
					root.classList.remove('dark');
					root.style.colorScheme = 'light';
				}
				return;
			}
			const expected = themeRef.current;
			const applied = resolveAppliedTheme();
			if (applied !== expected) {
				applyThemeClass(expected);
			}
		};

		const observer = new MutationObserver(syncClassToPreference);
		observer.observe(root, { attributes: true, attributeFilter: ['class'] });

		const onStorage = (event: StorageEvent) => {
			if (event.key !== THEME_STORAGE_KEY) return;
			const next: Theme = event.newValue === 'light' ? 'light' : 'dark';
			themeRef.current = next;
			setThemeState(next);
			if (!root.classList.contains('pdf-printing')) {
				applyThemeClass(next);
			}
		};
		const onBeforePrint = () => {
			addedPdfPrintingForPrint = !root.classList.contains('pdf-printing');
			applyPrintLight();
		};
		const onAfterPrint = () => {
			/* Preview / A4 views own `pdf-printing` for their lifetime. */
			if (addedPdfPrintingForPrint) {
				root.classList.remove('pdf-printing');
				applyThemeClass(themeRef.current);
			}
			addedPdfPrintingForPrint = false;
		};
		window.addEventListener('storage', onStorage);
		window.addEventListener('beforeprint', onBeforePrint);
		window.addEventListener('afterprint', onAfterPrint);

		return () => {
			observer.disconnect();
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('beforeprint', onBeforePrint);
			window.removeEventListener('afterprint', onAfterPrint);
		};
	}, []);

	const setTheme = useCallback((next: Theme) => {
		themeRef.current = next;
		setThemeState(next);
		persistTheme(next);
		if (!document.documentElement.classList.contains('pdf-printing')) {
			applyThemeClass(next);
		}
	}, []);

	const toggleTheme = useCallback(() => {
		const fromDom = resolveAppliedTheme();
		const current = themeRef.current === fromDom ? themeRef.current : fromDom;
		const next: Theme = current === 'dark' ? 'light' : 'dark';
		themeRef.current = next;
		setThemeState(next);
		persistTheme(next);
		if (!document.documentElement.classList.contains('pdf-printing')) {
			applyThemeClass(next);
		}
	}, []);

	const value = useMemo(
		() => ({ theme, setTheme, toggleTheme }),
		[theme, setTheme, toggleTheme],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
	const ctx = useContext(ThemeContext);
	if (!ctx) {
		throw new Error('useTheme must be used within ThemeProvider');
	}
	return ctx;
}
