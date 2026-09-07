import { GUEST_EMAIL } from '@/lib/admin/security-log-management';

export type RequestMeta = {
	ipAddress: string;
	userAgent: string;
	country: string;
};

type HeaderReader = {
	get(name: string): string | null;
};

type LooseHeaders = HeaderReader | Headers | Request | Record<string, unknown> | null | undefined;

function readHeader(source: LooseHeaders, name: string): string {
	if (!source) return '';
	if (typeof (source as HeaderReader).get === 'function') {
		return String((source as HeaderReader).get(name) || '');
	}
	if (typeof Request !== 'undefined' && source instanceof Request) {
		return source.headers.get(name) || '';
	}
	const rec = source as Record<string, unknown>;
	const direct = rec[name] ?? rec[name.toLowerCase()];
	if (Array.isArray(direct)) return String(direct[0] ?? '');
	return typeof direct === 'string' ? direct : '';
}

export function extractRequestMeta(source?: LooseHeaders): RequestMeta {
	const forwarded = readHeader(source, 'x-forwarded-for');
	const ipAddress =
		forwarded.split(',')[0]?.trim() ||
		readHeader(source, 'x-real-ip').trim() ||
		readHeader(source, 'cf-connecting-ip').trim() ||
		'-';
	const userAgent = readHeader(source, 'user-agent').trim();
	const country = (
		readHeader(source, 'x-vercel-ip-country') ||
		readHeader(source, 'cf-ipcountry') ||
		'KR'
	)
		.trim()
		.toUpperCase() || 'KR';

	return {
		ipAddress: ipAddress || '-',
		userAgent,
		country,
	};
}

export function parseUserAgent(userAgent: string): string {
	const ua = userAgent.trim();
	if (!ua) return '-';

	const os = /Windows NT|Windows/i.test(ua)
		? 'Windows'
		: /Mac OS X|Macintosh/i.test(ua)
			? 'macOS'
			: /iPhone|iPad|iOS/i.test(ua)
				? 'iOS'
				: /Android/i.test(ua)
					? 'Android'
					: /Linux/i.test(ua)
						? 'Linux'
						: 'Unknown';

	const browser = /Edg\//i.test(ua)
		? 'Edge'
		: /OPR\/|Opera/i.test(ua)
			? 'Opera'
			: /Chrome\//i.test(ua)
				? 'Chrome'
				: /Firefox\//i.test(ua)
					? 'Firefox'
					: /Safari\//i.test(ua)
						? 'Safari'
						: /curl\//i.test(ua)
							? 'curl'
							: /HeadlessChrome/i.test(ua)
								? 'Headless Chrome'
								: 'Unknown';

	return `${os} / ${browser}`;
}

export function normalizeLogEmail(email?: string | null): string {
	const value = (email || '').trim();
	return value || GUEST_EMAIL;
}
