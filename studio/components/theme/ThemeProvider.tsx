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
import { usePathname } from 'next/navigation';
import {
	applyThemeClass,
	isAdminPathname,
	persistThemeForPath,
	readThemeForPath,
	resolveAppliedTheme,
	themeStorageKey,
	type Theme,
} from '@/lib/theme';

type ThemeContextValue = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const isAdminRoute = isAdminPathname(pathname);
	const isAdminRouteRef = useRef(isAdminRoute);
	isAdminRouteRef.current = isAdminRoute;

	const [theme, setThemeState] = useState<Theme>(resolveAppliedTheme);
	const themeRef = useRef<Theme>(theme);
	themeRef.current = theme;

	useEffect(() => {
		const stored = readThemeForPath(isAdminRouteRef.current);
		themeRef.current = stored;
		setThemeState(stored);
		applyThemeClass(stored);

		const root = document.documentElement;
		let addedPdfPrintingForPrint = false;

		const applyPrintLight = () => {
			root.classList.add('pdf-printing', 'print-mode');
			root.classList.remove('dark');
			root.style.colorScheme = 'light';
		};

		const syncClassToPreference = () => {
			if (root.classList.contains('pdf-printing') || root.classList.contains('print-mode')) {
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
			const expectedKey = themeStorageKey(isAdminRouteRef.current);
			if (event.key !== expectedKey) return;
			const next = readThemeForPath(isAdminRouteRef.current);
			themeRef.current = next;
			setThemeState(next);
			if (!root.classList.contains('pdf-printing') && !root.classList.contains('print-mode')) {
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
				root.classList.remove('pdf-printing', 'print-mode', 'pdf-native-print');
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

	/** Public (`redue-theme`) and admin (`admin-theme`) preferences are independent. */
	useEffect(() => {
		if (typeof document === 'undefined') return;
		if (
			document.documentElement.classList.contains('pdf-printing') ||
			document.documentElement.classList.contains('print-mode')
		) {
			return;
		}
		const stored = readThemeForPath(isAdminRoute);
		themeRef.current = stored;
		setThemeState(stored);
		applyThemeClass(stored);
	}, [isAdminRoute]);

	const setTheme = useCallback((next: Theme) => {
		themeRef.current = next;
		setThemeState(next);
		persistThemeForPath(isAdminRouteRef.current, next);
		if (
			!document.documentElement.classList.contains('pdf-printing') &&
			!document.documentElement.classList.contains('print-mode')
		) {
			applyThemeClass(next);
		}
	}, []);

	const toggleTheme = useCallback(() => {
		const fromDom = resolveAppliedTheme();
		const current = themeRef.current === fromDom ? themeRef.current : fromDom;
		const next: Theme = current === 'dark' ? 'light' : 'dark';
		themeRef.current = next;
		setThemeState(next);
		persistThemeForPath(isAdminRouteRef.current, next);
		if (
			!document.documentElement.classList.contains('pdf-printing') &&
			!document.documentElement.classList.contains('print-mode')
		) {
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
