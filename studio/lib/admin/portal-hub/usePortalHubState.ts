'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_DOMAIN, DEFAULT_NAVER_VERIFICATION_CODE } from './data';
import type { PortalHubStoredState } from './types';

const STORAGE_KEY = 'redue_admin_portal_hub_v1';

const DEFAULT_STATE: PortalHubStoredState = {
	domain: DEFAULT_DOMAIN,
	naverVerificationCode: DEFAULT_NAVER_VERIFICATION_CODE,
	checklist: {},
};

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function loadState(): PortalHubStoredState {
	if (!isBrowser()) return DEFAULT_STATE;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_STATE;
		const parsed = JSON.parse(raw) as Partial<PortalHubStoredState>;
		return {
			domain: typeof parsed.domain === 'string' && parsed.domain.trim() ? parsed.domain : DEFAULT_DOMAIN,
			naverVerificationCode:
				typeof parsed.naverVerificationCode === 'string' && parsed.naverVerificationCode.trim()
					? parsed.naverVerificationCode
					: DEFAULT_NAVER_VERIFICATION_CODE,
			checklist: parsed.checklist && typeof parsed.checklist === 'object' ? parsed.checklist : {},
		};
	} catch {
		return DEFAULT_STATE;
	}
}

/**
 * Persists the Portal Hub's checklist progress + domain/verification inputs to
 * `localStorage` so progress survives refreshes. Lazily hydrates on mount to
 * avoid SSR/client markup mismatches.
 */
export function usePortalHubState() {
	const [state, setState] = useState<PortalHubStoredState>(DEFAULT_STATE);
	const hydrated = useRef(false);

	useEffect(() => {
		setState(loadState());
		hydrated.current = true;
	}, []);

	useEffect(() => {
		if (!hydrated.current || !isBrowser()) return;
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch {
			// Ignore quota / privacy-mode failures — progress simply won't persist.
		}
	}, [state]);

	const setDomain = useCallback((domain: string) => {
		setState((prev) => ({ ...prev, domain }));
	}, []);

	const setNaverVerificationCode = useCallback((naverVerificationCode: string) => {
		setState((prev) => ({ ...prev, naverVerificationCode }));
	}, []);

	const toggleChecklistItem = useCallback((id: string) => {
		setState((prev) => ({
			...prev,
			checklist: { ...prev.checklist, [id]: !prev.checklist[id] },
		}));
	}, []);

	const isChecked = useCallback((id: string) => Boolean(state.checklist[id]), [state.checklist]);

	return {
		domain: state.domain,
		naverVerificationCode: state.naverVerificationCode,
		checklist: state.checklist,
		setDomain,
		setNaverVerificationCode,
		toggleChecklistItem,
		isChecked,
	};
}
