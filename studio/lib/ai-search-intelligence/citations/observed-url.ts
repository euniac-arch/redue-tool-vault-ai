import { citationDomain } from '@/lib/ai-search-intelligence/citations/classify';

const INVENTED_HOST = /(^|\.)(example\.(com|net|org)|localhost)$/i;
const INVENTED_LABEL = /^(fake|placeholder|hallucinated)(\.|$)/i;

/** Dummy hosts that must never become Evidence (news.example.com, localhost, …). */
export function isInventedCitationUrl(url: string): boolean {
	const host = citationDomain(url);
	if (!host) return true;
	if (host === 'localhost' || host.startsWith('127.') || host.endsWith('.localhost')) return true;
	if (INVENTED_HOST.test(host) || INVENTED_LABEL.test(host)) return true;
	return false;
}

export function isObservedHttpUrl(url: string): boolean {
	const trimmed = url.trim().replace(/[),.;]+$/, '');
	return /^https?:\/\//i.test(trimmed) && !isInventedCitationUrl(trimmed);
}

export function sanitizeObservedUrl(url: string): string {
	return url.trim().replace(/[),.;]+$/, '');
}
