/**
 * GEO /llms.txt deploy helpers — menu-row identity, markdown builder, remote root path.
 */

import { extractOrgContactFromFooter } from '@/lib/solve/dynamic-php-schema';
import type { AuditPageMeta, SchemaNavItem } from '@/lib/solve/dynamic-php-schema';
import {
	buildOfficialLlmsTxt,
	extractKoreanStreetAddress,
	toLlmsPlainString,
	type LlmsMenuItem,
} from '@/lib/solve/llms-content-engine';
import type { SolvePageMeta } from '@/lib/solve/types';

export const LLMS_TXT_RELATIVE_PATH = 'llms.txt';
export const LLMS_TXT_UPLOAD_LOG = '[진행] AI 탐색용 llms.txt 파일 생성 및 루트 업로드 완료';

export function isLlmsTxtDeployPath(urlPath: string | undefined): boolean {
	const raw = String(urlPath || '')
		.trim()
		.split('#')[0]
		.split('?')[0]
		.replace(/\\/g, '/')
		.replace(/\/+$/, '');
	if (!raw) return false;
	return /(^|\/)llms\.txt$/i.test(raw) || /^llms\.txt$/i.test(raw);
}

export function isLlmsTxtDeployPage(page: { urlPath?: string; title?: string }): boolean {
	if (isLlmsTxtDeployPath(page.urlPath)) return true;
	return /^llms\.txt$/i.test(String(page.title || '').trim());
}

export function createLlmsTxtMenuRow(): SolvePageMeta {
	return {
		urlPath: '/llms.txt',
		title: 'llms.txt',
		description: 'AI 크롤러·GEO 인용용 루트 인덱스 (서버 루트에 단독 파일로 배포)',
		section: 'AI / GEO',
		menu1: 'AI / GEO',
		pageType: 'SpecialAnnouncement',
		selected: true,
	};
}

export function ensureLlmsTxtMenuRow(pages: SolvePageMeta[]): SolvePageMeta[] {
	const list = Array.isArray(pages) ? pages : [];
	if (list.some(isLlmsTxtDeployPage)) return list;
	return [...list, createLlmsTxtMenuRow()];
}

export function isRootAssetFilePath(urlPath: string | undefined): boolean {
	const raw = String(urlPath || '')
		.trim()
		.split('#')[0]
		.split('?')[0]
		.replace(/\\/g, '/')
		.replace(/\/+$/, '');
	return /(^|\/)(robots\.txt|sitemap\.xml|llms\.txt|llms-full\.txt)$/i.test(raw);
}

export function excludeLlmsTxtFromSchemaPages<T extends { urlPath?: string; title?: string }>(
	pages: T[],
): T[] {
	return pages.filter((page) => !isLlmsTxtDeployPage(page) && !isRootAssetFilePath(page.urlPath));
}

export type LlmsTxtDeployInput = {
	siteName?: string;
	targetUrl?: string;
	industryType?: string;
	pages?: Array<AuditPageMeta | SolvePageMeta>;
	navItems?: SchemaNavItem[];
	footerText?: string;
	legalName?: string;
	representativeName?: string;
	representativeTitle?: string;
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	postalCode?: string;
	telephone?: string;
	mainDescription?: string;
	openingHoursOpens?: string;
	openingHoursCloses?: string;
};

function pageLabel(page: AuditPageMeta | SolvePageMeta): string {
	return toLlmsPlainString(page.title || page.section || page.menu1 || page.urlPath || '');
}

function stemFromPath(urlPath: string | undefined): string {
	const raw = String(urlPath || '')
		.split('#')[0]
		.split('?')[0]
		.replace(/\\/g, '/');
	return (raw.split('/').pop() || '').replace(/\.(php|html?|htm|phtml)$/i, '');
}

export function menusFromLlmsDeployInput(input: LlmsTxtDeployInput): LlmsMenuItem[] {
	const schemaPages = excludeLlmsTxtFromSchemaPages(input.pages || []);
	const fromNav: LlmsMenuItem[] = (input.navItems || []).map((item) => ({
		name: toLlmsPlainString(item.name),
		url: toLlmsPlainString(item.url),
		fileStem: stemFromPath(item.url),
	}));
	const fromPages: LlmsMenuItem[] = schemaPages
		.filter((page) => {
			const path = String(page.urlPath || '').trim();
			return path && path !== '/' && !/^\/?(index\.(php|html?))?$/i.test(path);
		})
		.map((page) => ({
			name: pageLabel(page),
			url: String(page.urlPath || ''),
			description: toLlmsPlainString(page.description || page.h1 || ''),
			h2: toLlmsPlainString(page.h1 || ''),
			fileStem: stemFromPath(page.urlPath),
		}));
	return [...fromNav, ...fromPages].filter((item) => item.name && item.url);
}

export function resolveLlmsDeployAddress(input: LlmsTxtDeployInput): string {
	const contact = extractOrgContactFromFooter(input.footerText || '');
	const street = toLlmsPlainString(input.streetAddress || contact.address?.streetAddress || '');
	const locality = toLlmsPlainString(input.addressLocality || contact.address?.addressLocality || '');
	const region = toLlmsPlainString(input.addressRegion || contact.address?.addressRegion || '');
	const postal = toLlmsPlainString(input.postalCode || contact.address?.postalCode || '');
	const joined = [postal, region, locality, street].filter(Boolean).join(' ').trim();
	return extractKoreanStreetAddress(joined) || extractKoreanStreetAddress(street) || joined;
}

export function resolveLlmsDeployHours(input: LlmsTxtDeployInput): string {
	const opens = toLlmsPlainString(input.openingHoursOpens);
	const closes = toLlmsPlainString(input.openingHoursCloses);
	if (opens && closes) return `${opens}–${closes}`;
	return '';
}

export function buildSolveLlmsTxtMarkdown(input: LlmsTxtDeployInput): string {
	const origin = (() => {
		try {
			return new URL(input.targetUrl || 'https://example.com').origin.replace(/^http:\/\//i, 'https://');
		} catch {
			return 'https://example.com';
		}
	})();
	const contact = extractOrgContactFromFooter(input.footerText || '');
	return buildOfficialLlmsTxt({
		siteName: toLlmsPlainString(input.siteName || input.legalName) || origin.replace(/^https?:\/\//i, ''),
		origin,
		industry: input.industryType,
		representativeName: toLlmsPlainString(input.representativeName),
		telephone: toLlmsPlainString(input.telephone || contact.telephone),
		address: resolveLlmsDeployAddress(input),
		openingHours: resolveLlmsDeployHours(input),
		intro: toLlmsPlainString(input.mainDescription),
		menus: menusFromLlmsDeployInput(input),
		faqs: [],
	});
}
