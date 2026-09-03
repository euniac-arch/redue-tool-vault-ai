export const MYPAGE_GUEST_ID_KEY = 'redue_mypage_user_id';

export function resolveMypageUserId(sessionUserId?: string | null): string {
	const signedIn = sessionUserId?.trim();
	if (signedIn) return signedIn;
	if (typeof window === 'undefined') return 'guest';
	try {
		const existing = window.localStorage.getItem(MYPAGE_GUEST_ID_KEY)?.trim();
		if (existing) return existing;
		const next = `guest_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
		window.localStorage.setItem(MYPAGE_GUEST_ID_KEY, next);
		return next;
	} catch {
		return 'guest';
	}
}
