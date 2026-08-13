export const AUDIT_HERO_ID = 'audit-hero';
export const AUDIT_URL_INPUT_ID = 'audit-url-input';

/** Smooth-scroll to the landing URL form and focus the input. */
export function scrollToAuditForm() {
	const section = document.getElementById(AUDIT_HERO_ID);
	const input = document.getElementById(AUDIT_URL_INPUT_ID) as HTMLInputElement | null;
	section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	window.setTimeout(() => {
		input?.focus({ preventScroll: true });
	}, 450);
}
