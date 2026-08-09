import dns from 'node:dns';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', '0.0.0.0']);

/** Checks an IPv4 dotted string against RFC1918 / loopback / link-local / cloud-metadata ranges. */
function isPrivateIpv4(ip: string): boolean {
	const parts = ip.split('.').map(Number);
	if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
	const [a, b] = parts;
	if (a === 127) return true; // loopback
	if (a === 10) return true; // RFC1918
	if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
	if (a === 192 && b === 168) return true; // RFC1918
	if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
	if (a === 0) return true;
	return false;
}

function isPrivateIpv6(ip: string): boolean {
	const normalized = ip.toLowerCase();
	return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
}

export class UnsafeAuditUrlError extends Error {}

/**
 * Validates that `input` is a safe, public http(s) URL before the server
 * fetches it on a stranger's behalf (the `/api/audit/scan` endpoint is
 * unauthenticated). Blocks obviously-internal hostnames outright, then
 * resolves DNS and blocks private/loopback/link-local/cloud-metadata IP
 * ranges to defend against SSRF (including DNS-rebinding attempts).
 */
export async function assertPublicHttpUrl(input: string): Promise<URL> {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		throw new UnsafeAuditUrlError('올바른 URL 형식이 아닙니다. (예: https://example.com)');
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new UnsafeAuditUrlError('http 또는 https URL만 진단할 수 있습니다.');
	}

	const hostname = url.hostname.toLowerCase();
	if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
		throw new UnsafeAuditUrlError('내부/로컬 호스트는 진단할 수 없습니다.');
	}
	if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
		throw new UnsafeAuditUrlError('사설/내부 IP 대역은 진단할 수 없습니다.');
	}

	let addresses: string[];
	try {
		const results = await dns.promises.lookup(hostname, { all: true });
		addresses = results.map((r) => r.address);
	} catch {
		throw new UnsafeAuditUrlError('도메인을 확인(DNS)할 수 없습니다. 주소를 다시 확인해 주세요.');
	}

	for (const address of addresses) {
		if (isPrivateIpv4(address) || isPrivateIpv6(address)) {
			throw new UnsafeAuditUrlError('이 도메인은 내부 네트워크 주소로 연결되어 진단할 수 없습니다.');
		}
	}

	return url;
}
