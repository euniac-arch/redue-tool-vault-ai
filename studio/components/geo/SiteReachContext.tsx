'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { activeReachSlice, type ReachMode, type ReachSlice, type SiteReachState } from '@/types/site-reach';

interface SiteReachContextValue {
	state: SiteReachState;
	activeMode: ReachMode;
	setActiveMode: (mode: ReachMode) => void;
	activeSlice: ReachSlice;
	isAfterView: boolean;
}

const SiteReachContext = createContext<SiteReachContextValue | null>(null);

export function SiteReachProvider({
	state,
	mode,
	onModeChange,
	children,
}: {
	state: SiteReachState;
	mode: ReachMode;
	onModeChange: (mode: ReachMode) => void;
	children: ReactNode;
}) {
	const setActiveMode = useCallback(
		(next: ReachMode) => {
			onModeChange(next);
		},
		[onModeChange],
	);

	const value = useMemo<SiteReachContextValue>(
		() => ({
			state,
			activeMode: mode,
			setActiveMode,
			activeSlice: activeReachSlice(state, mode),
			isAfterView: mode === 'toBe',
		}),
		[state, mode, setActiveMode],
	);

	return <SiteReachContext.Provider value={value}>{children}</SiteReachContext.Provider>;
}

export function useSiteReach(): SiteReachContextValue {
	const ctx = useContext(SiteReachContext);
	if (!ctx) {
		throw new Error('useSiteReach must be used within SiteReachProvider');
	}
	return ctx;
}

export function useOptionalSiteReach(): SiteReachContextValue | null {
	return useContext(SiteReachContext);
}
