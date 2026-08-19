export const AUDIT_HERO_ID = 'audit-hero';
export const AUDIT_START_AREA_ID = 'audit-start-area';
export const AUDIT_URL_INPUT_ID = 'audit-url-input';

/** Smooth-scroll to the landing URL form, or open the home hero when off-page. */
export function scrollToAuditForm() {
	const section = document.getElementById(AUDIT_HERO_ID);
	if (!section) {
		window.location.assign(`/#${AUDIT_HERO_ID}`);
		return;
	}
	const input = document.getElementById(AUDIT_URL_INPUT_ID) as HTMLInputElement | null;
	section.scrollIntoView({ behavior: 'smooth', block: 'start' });
	window.setTimeout(() => {
		input?.focus({ preventScroll: true });
	}, 450);
}
