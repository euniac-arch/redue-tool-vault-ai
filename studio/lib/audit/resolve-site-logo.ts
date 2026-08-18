/**
 * Server-only deep logo probe (manifest / path / Clearbit).
 * Do not import this module from client components — it pulls fetch-page + node:dns.
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import {
	extractHeaderLogoUrl,
	extractIconLogoUrl,
	extractInlineSvgLogoFromDom,
	extractOgImageUrl,
	extractSchemaLogoUrl,
	pickManifestIconUrl,
	readLogoSchemaNodes,
	toAbsoluteLogoUrl,
} from '@/lib/audit/extract-site-logo';
import { AUDIT_USER_AGENT, fetchPageResource } from '@/lib/audit/fetch-page';
import { clearbitLogoUrl, googleFaviconV2Url, hostnameFromUrl, originFromUrl } from '@/lib/audit/logo-url';
import { assertPublicHttpUrl } from '@/lib/ssrf-guard';

const IMAGE_PROBE_TIMEOUT_MS = 1_800;
const LOGO_PROBE_BUDGET_MS = 4_500;
const MANIFEST_TIMEOUT_MS = 3_000;

const COMMON_LOGO_PATHS = [
	'/logo.svg',
	'/logo.png',
	'/logo.webp',
	'/images/logo.svg',
	'/images/logo.png',
	'/img/logo.svg',
	'/img/logo.png',
	'/assets/logo.svg',
	'/assets/logo.png',
	'/assets/images/logo.png',
	'/static/logo.svg',
	'/static/logo.png',
	'/media/logo.png',
	'/img/common/logo.png',
	'/images/common/logo.png',
	'/theme/logo.png',
	'/data/logo.png',
	'/android-chrome-512x512.png',
	'/android-chrome-192x192.png',
	'/apple-touch-icon.png',
	'/apple-touch-icon-180x180.png',
] as const;

export interface CheckImageExistsOptions {
	timeoutMs?: number;
	sameOrigin?: string;
}

export interface ResolveSiteLogoOptions {
	$?: CheerioAPI;
	schemaNodes?: Record<string, unknown>[];
	ogImage?: string | null;
	skipNetwork?: boolean;
}

function isImageContentType(contentType: string | null): boolean {
	const type = (contentType || '').toLowerCase();
	return type.startsWith('image/') || type.includes('svg') || type.includes('icon');
}

function looksLikeImagePayload(bytes: Uint8Array, contentType: string | null): boolean {
	const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 80)).trimStart();
	if (/^<!doctype html/i.test(head) || /^<html[\s>]/i.test(head)) return false;
	if (isImageContentType(contentType)) return true;
	if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return true;
	}
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
	if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
	if (bytes.length >= 12 && head.startsWith('RIFF') && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') {
		return true;
	}
	if (/^<\?xml/i.test(head) || /^<svg[\s>]/i.test(head)) return true;
	if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
		return true;
	}
	return false;
}

async function readResponsePrefix(res: Response, maxBytes = 256): Promise<Uint8Array> {
	if (!res.body) {
		const all = new Uint8Array(await res.arrayBuffer());
		return all.subarray(0, maxBytes);
	}
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;
	try {
		while (received < maxBytes) {
			const { done, value } = await reader.read();
			if (done || !value) break;
			chunks.push(value);
			received += value.length;
		}
	} finally {
		try {
			await reader.cancel();
		} catch {
			/* ignore */
		}
	}
	const out = new Uint8Array(Math.min(received, maxBytes));
	let offset = 0;
	for (const chunk of chunks) {
		const slice = chunk.subarray(0, maxBytes - offset);
		out.set(slice, offset);
		offset += slice.length;
		if (offset >= maxBytes) break;
	}
	return out;
}

export async function checkImageExists(
	url: string,
	opts?: CheckImageExistsOptions,
): Promise<boolean> {
	const timeoutMs = opts?.timeoutMs ?? IMAGE_PROBE_TIMEOUT_MS;
	let target: URL;
	try {
		if (opts?.sameOrigin) {
			target = new URL(url);
			if (target.origin !== opts.sameOrigin) return false;
		} else {
			target = await assertPublicHttpUrl(url);
		}
	} catch {
		return false;
	}

	try {
		const res = await fetch(target.href, {
			method: 'GET',
			headers: {
				'User-Agent': AUDIT_USER_AGENT,
				Accept: 'image/avif,image/webp,image/svg+xml,image/*,*/*;q=0.4',
				Range: 'bytes=0-255',
			},
			cache: 'no-store',
			redirect: 'follow',
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!res.ok && res.status !== 206) return false;
		if (opts?.sameOrigin) {
			try {
				if (new URL(res.url).origin !== opts.sameOrigin) return false;
			} catch {
				return false;
			}
		}
		const buf = await readResponsePrefix(res, 256);
		if (buf.length < 8) return false;
		return looksLikeImagePayload(buf, res.headers.get('content-type'));
	} catch {
		return false;
	}
}

function manifestHrefFromHtml($: CheerioAPI, baseUrl: string): string | null {
	const href =
		$('link[rel="manifest"]').attr('href')?.trim() ||
		$('link[rel="Manifest"]').attr('href')?.trim() ||
		'';
	if (href) return toAbsoluteLogoUrl(href, baseUrl);
	try {
		return new URL('/manifest.json', baseUrl).href;
	} catch {
		return null;
	}
}

export async function fetchManifestLogo(html: string, baseUrl: string): Promise<string | null> {
	const $ = cheerio.load(html || '');
	const manifestUrl = manifestHrefFromHtml($, baseUrl);
	if (!manifestUrl) return null;

	const origin = originFromUrl(baseUrl);
	const page = await fetchPageResource(manifestUrl, {
		timeoutMs: MANIFEST_TIMEOUT_MS,
		accept: 'application/manifest+json,application/json,text/json,*/*;q=0.4',
		skipSsrf: Boolean(origin && originFromUrl(manifestUrl) === origin),
		maxChars: 80_000,
		maxRedirects: 3,
	});
	if (!page.ok || !page.text.trim()) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(page.text);
	} catch {
		return null;
	}

	const iconUrl = pickManifestIconUrl(parsed, page.finalUrl || baseUrl);
	if (!iconUrl) return null;
	const sameOrigin = originFromUrl(iconUrl) === origin ? origin : undefined;
	try {
		const ok = await checkImageExists(iconUrl, { sameOrigin, timeoutMs: IMAGE_PROBE_TIMEOUT_MS });
		if (ok) return iconUrl;
	} catch {
		/* declared manifest icons are still the best candidate */
	}
	return iconUrl;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size) as T[]);
	return out;
}

export async function probeCommonLogoPaths(baseUrl: string): Promise<string | null> {
	const origin = originFromUrl(baseUrl);
	if (!origin) return null;

	const started = Date.now();
	for (const batch of chunk(COMMON_LOGO_PATHS, 5)) {
		if (Date.now() - started > LOGO_PROBE_BUDGET_MS) break;
		const hits = await Promise.all(
			batch.map(async (path) => {
				const url = `${origin}${path}`;
				return (await checkImageExists(url, { sameOrigin: origin })) ? url : null;
			}),
		);
		const found = hits.find((row): row is string => Boolean(row));
		if (found) return found;
	}
	return null;
}

export async function resolveSiteLogo(
	html: string,
	baseUrl: string,
	domain: string,
	options?: ResolveSiteLogoOptions,
): Promise<string | null> {
	const $ = options?.$ ?? cheerio.load(html || '<html></html>');
	const nodes = options?.schemaNodes?.length ? options.schemaNodes : readLogoSchemaNodes($, html);

	const schemaLogo = extractSchemaLogoUrl(nodes, baseUrl);
	if (schemaLogo) return schemaLogo;

	const domImgLogo = extractHeaderLogoUrl($, baseUrl);
	if (domImgLogo) return domImgLogo;

	const inlineSvgLogo = extractInlineSvgLogoFromDom($, baseUrl);
	if (inlineSvgLogo) return inlineSvgLogo;

	if (!options?.skipNetwork) {
		try {
			const manifestLogo = await fetchManifestLogo(html, baseUrl);
			if (manifestLogo) return manifestLogo;
		} catch {
			/* continue */
		}

		try {
			const probedLogo = await probeCommonLogoPaths(baseUrl);
			if (probedLogo) return probedLogo;
		} catch {
			/* continue */
		}

		const clearbit = clearbitLogoUrl(domain || hostnameFromUrl(baseUrl));
		if (clearbit) {
			try {
				if (await checkImageExists(clearbit)) return clearbit;
			} catch {
				/* continue */
			}
		}
	}

	const appleOrIcon = extractIconLogoUrl($, baseUrl);
	if (appleOrIcon) return appleOrIcon;

	const og = extractOgImageUrl($, baseUrl, options?.ogImage);
	if (og) return og;

	return googleFaviconV2Url(baseUrl) || null;
}
