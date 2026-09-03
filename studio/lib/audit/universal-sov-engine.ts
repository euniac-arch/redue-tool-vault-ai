/**
 * Universal SoV / AI-ranking analysis engine.
 *
 * Works for any audited URL: brand aliases are extracted from live HTML
 * metadata, citations are classified as owned / brand-earned / unbranded,
 * and each query is aggregated independently into `UniversalQuerySov`.
 */

import {
	collectBrandEntities,
	expandBrandAliases,
	foldEntityKey,
	type BrandEntitySeed,
	type BrandEntitySet,
} from '@/lib/geo/brand-entities';
import { isExternalCitationHost, isOfficialCitationHost, hostnameFromUrl } from '@/lib/audit/engine-insight';
import { urlMatchesSite } from '@/lib/audit/live-check-mentions';

/** 1 / 2 / 3 when in the top 3; 0 when outside the ranking. */
export type UniversalSovRank = 0 | 1 | 2 | 3;

export type CitationOwnership = 'owned' | 'brand_earned' | 'unbranded_third_party';

export interface UniversalQuerySov {
	query: string;
	rank: number;
	targetBrandScore: number;
	topCompetitors: Array<{
		rank: number;
		name: string;
		sharePercent: number;
		isTarget: boolean;
	}>;
	thirdPartyShare: number;
	citations: Array<{
		title: string;
		url: string;
		isTargetMention: boolean;
	}>;
}

export interface UniversalSovContext {
	targetUrl: string;
	canonicalBrand: string;
	domain: string;
	brandAliases: string[];
	entities: BrandEntitySet;
}

export interface BrandAliasExtractionInput {
	targetUrl?: string;
	domain?: string;
	brandName?: string;
	pageTitle?: string;
	title?: string;
	ogTitle?: string;
	ogSiteName?: string;
	organizationName?: string;
	schemaOrganizationNames?: readonly string[];
	representativeName?: string;
	personNames?: readonly string[];
	keywords?: string;
	keywordList?: readonly string[];
	description?: string;
}

export interface CitationClassifyInput {
	title?: string;
	url: string;
	snippet?: string;
	body?: string;
	targetUrl: string;
	brandAliases: readonly string[];
}

export interface ClassifiedCitation {
	title: string;
	url: string;
	isTargetMention: boolean;
	ownership: CitationOwnership;
}

export interface UniversalQuerySovInput {
	query: string;
	context: Pick<UniversalSovContext, 'targetUrl' | 'brandAliases' | 'canonicalBrand'>;
	/** 1-based live rank; 4+ or missing → 0 (순위 밖). */
	clientRank?: number;
	asIsShare?: number;
	thirdPartyShare?: number;
	leaderboard?: ReadonlyArray<{
		rank: number;
		name: string;
		share: number;
		isClient?: boolean;
		isThirdParty?: boolean;
	}>;
	citations?: ReadonlyArray<{
		title?: string;
		url?: string;
		snippet?: string;
		body?: string;
	}>;
}

const DOMAIN_HANGUL: Record<string, string> = {
	example: '익스플',
	clinic: '클리닉',
	hospital: '호스피탈',
	dental: '덴탈',
	health: '헬스',
	beauty: '뷰티',
	skin: '스킨',
	care: '케어',
	lab: '랩',
	center: '센터',
	studio: '스튜디오',
};

const LEGAL_BRAND_SUFFIXES = [
	'의원',
	'병원',
	'클리닉',
	'치과',
	'한의원',
	'약국',
	'학원',
	'스튜디오',
	'주식회사',
	'유한회사',
	'clinic',
	'hospital',
	'dental',
	'studio',
	'lab',
	'center',
	'official',
	'korea',
	'inc',
	'ltd',
	'llc',
	'corp',
] as const;

const SPECIALIZED_TOKEN_RE =
	/엘리트|울트라|클리어|레이저|리프팅|임플란트|장비|기기|시리즈|프로|플러스|ultra|laser|implant|elite|clear|plus|[A-Za-z]{3,}\d|\d[A-Za-z]{3,}/i;

const GENERIC_LOCAL_INTENT_RE = /추천|잘하는곳|잘하는 곳|맛집|베스트|best\b|recommended|where is|near me/i;

const GENERIC_SERVICE_NOUN_RE =
	/^(내과|외과|치과|피부과|피부미용|한의원|병원|의원|클리닉|학원|맛집|카페|부동산|법률|세무|인테리어|헬스|피트니스|약국|상담|치료|시술|검진|건강검진|도수치료|추나치료)$/i;

export function isSpecializedProductToken(token: string): boolean {
	const t = clean(token, 60);
	if (!t || GENERIC_SERVICE_NOUN_RE.test(t) || isGenericBrandSuffix(t)) return false;
	if (SPECIALIZED_TOKEN_RE.test(t)) return true;
	return /[가-힣]{5,}/.test(t.replace(/\s+/g, '')) || /[A-Za-z]{4,}\d/.test(t);
}

export type QuerySovIntent = 'navigational' | 'specialized' | 'generic';

export interface QuerySovShareTable {
	intent: QuerySovIntent;
	clientRank: number;
	own: number;
	rank1: number;
	rank2: number;
	thirdParty: number;
	targetSov: number;
	potentialGain: number;
}

export interface QuerySovShareInput {
	query: string;
	brandTokens?: readonly string[];
	productTokens?: readonly string[];
	/** 1-based live search rank; 4+ or missing = outside top 3. */
	clientRank?: number;
	cited?: boolean;
	citations?: readonly ClassifiedCitation[];
	/** Building/floor query where the audited brand is the only same-industry occupant. */
	placeMonopoly?: boolean;
	/** Target site officially offers the niche equipment / signature service in the query. */
	nicheLeadership?: boolean;
}

const NEGATION_CUES = [
	'언급되지',
	'언급하지',
	'포함되지',
	'추천되지',
	'인용되지',
	'찾을 수 없',
	'정보가 없',
	'not mention',
	'not recommend',
	'not cited',
	'not found',
	'no information',
	'is not mentioned',
];

function clean(value: unknown, max = 80): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function domainFromUrl(raw?: string): string {
	if (!raw) return '';
	try {
		return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./i, '').toLowerCase();
	} catch {
		return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]?.toLowerCase() || '';
	}
}

export function domainHeadFromHost(domain?: string): string {
	if (!domain) return '';
	const host = domain.replace(/^www\./i, '').split('/')[0]?.split(':')[0] || '';
	const labels = host.split('.').filter(Boolean);
	const skip = new Set(['com', 'co', 'kr', 'net', 'org', 'io', 'ai', 'gg', 'me', 'info', 'biz']);
	const head = labels.find((label) => !skip.has(label.toLowerCase()) && label.length >= 2) || labels[0] || '';
	return head.length >= 2 ? head : '';
}

/** Lowercase + strip whitespace / punctuation for matching keys. */
export function normalizeBrandAlias(value: string): string {
	return foldEntityKey(value);
}

export function normalizeBrandAliases(values: readonly string[], limit = 40): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const display = clean(raw, 60);
		if (!display || display.length < 2) continue;
		const key = normalizeBrandAlias(display);
		if (!key || key.length < 2 || seen.has(key)) continue;
		seen.add(key);
		out.push(display);
		if (out.length >= limit) break;
	}
	return out;
}

/**
 * Domain host → latin head + Hangul approximation.
 * `example.com` → `example`, `익스플`
 */
export function isGenericBrandSuffix(token: string): boolean {
	const folded = normalizeBrandAlias(token);
	return LEGAL_BRAND_SUFFIXES.some((suffix) => normalizeBrandAlias(suffix) === folded);
}

/** Strip legal / industry suffixes: `나인원의원` → `나인원`, `nineoneclinic` → `nineone`. */
export function stripBrandLegalSuffix(value: string): string {
	let out = clean(value, 60);
	if (!out) return '';
	const sorted = [...LEGAL_BRAND_SUFFIXES].sort((a, b) => b.length - a.length);
	for (const suffix of sorted) {
		const re = new RegExp(`${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
		if (!re.test(out)) continue;
		const stripped = out.replace(re, '').replace(/[\s_-]+$/g, '').trim();
		const minLen = /[가-힣]/.test(stripped) ? 2 : 3;
		if (stripped.length >= minLen && !isGenericBrandSuffix(stripped)) return stripped;
	}
	return out;
}

export function domainHeadAliases(domainOrUrl?: string): string[] {
	const host = domainFromUrl(domainOrUrl) || (domainOrUrl || '').replace(/^www\./i, '');
	const head = domainHeadFromHost(host);
	if (!head) return [];
	const compact = head.replace(/[-_]/g, '');
	const stripped = stripBrandLegalSuffix(compact);
	const mapped = DOMAIN_HANGUL[head.toLowerCase()] || DOMAIN_HANGUL[compact.toLowerCase()] || DOMAIN_HANGUL[stripped.toLowerCase()];
	const hangul = mapped || expandBrandAliases(stripped || head).find((alias) => /[가-힣]{2,}/.test(alias)) || '';
	return normalizeBrandAliases([head, compact, stripped, hangul].filter(Boolean), 10);
}

/**
 * Universal brand-identifier set from crawl metadata + domain head.
 * Includes suffix-stripped forms (`나인원`, `nineone`) for navigational matching.
 */
export function buildTargetBrandTokens(
	aliases: readonly string[],
	canonical?: string,
	domain?: string,
): string[] {
	const seeds = [...aliases, canonical || '', ...domainHeadAliases(domain)];
	const expanded: string[] = [];
	for (const seed of seeds) {
		const display = clean(seed, 60);
		if (!display) continue;
		expanded.push(display, display.replace(/\s+/g, ''), stripBrandLegalSuffix(display));
	}
	return normalizeBrandAliases(
		expanded.filter((token) => token.length >= 2 && !isGenericBrandSuffix(token)),
		48,
	);
}

export function extractTargetBrandTokens(input: BrandAliasExtractionInput): string[] {
	const ctx = extractBrandAliasesFromMeta(input);
	return buildTargetBrandTokens(ctx.brandAliases, ctx.canonicalBrand, ctx.domain || domainFromUrl(ctx.targetUrl));
}

export function queryContainsBrandToken(query: string, tokens: readonly string[]): boolean {
	const qFold = normalizeBrandAlias(query);
	const qLower = (query || '').toLowerCase();
	if (!qFold) return false;
	return tokens.some((token) => {
		const display = clean(token, 60);
		if (!display || isGenericBrandSuffix(display)) return false;
		const folded = normalizeBrandAlias(display);
		const minLen = /[가-힣]/.test(display) ? 2 : 4;
		if (!folded || folded.length < minLen) return false;
		return qFold.includes(folded) || qLower.includes(display.toLowerCase());
	});
}

export function classifyQuerySovIntent(
	query: string,
	brandTokens: readonly string[] = [],
	productTokens: readonly string[] = [],
): QuerySovIntent {
	if (queryContainsBrandToken(query, brandTokens)) return 'navigational';
	const compact = clean(query, 120);
	if (!compact) return 'generic';
	const qFold = normalizeBrandAlias(compact);
	if (
		productTokens.some((token) => {
			if (!isSpecializedProductToken(token)) return false;
			const folded = normalizeBrandAlias(token);
			return folded.length >= 2 && qFold.includes(folded);
		})
	) {
		return 'specialized';
	}
	if (SPECIALIZED_TOKEN_RE.test(compact) && !GENERIC_SERVICE_NOUN_RE.test(compact.replace(/\s+/g, ''))) {
		return 'specialized';
	}
	if (GENERIC_LOCAL_INTENT_RE.test(compact)) return 'generic';
	return 'generic';
}

function seedFromExtraction(input: BrandAliasExtractionInput): BrandEntitySeed {
	const domain = input.domain || domainFromUrl(input.targetUrl);
	return {
		brandName: input.brandName,
		name: input.organizationName,
		title: input.pageTitle || input.title,
		ogTitle: input.ogTitle,
		ogSiteName: input.ogSiteName,
		keywords: input.keywords,
		keywordList: [
			...(input.keywordList ?? []),
			...(input.schemaOrganizationNames ?? []),
			input.organizationName || '',
		].filter(Boolean),
		description: input.description,
		representativeName: input.representativeName,
		personNames: input.personNames,
		domain,
	};
}

/**
 * Build a diagnostic brand-alias set from crawl metadata.
 * Sources: pageTitle, og:site_name, og:title, JSON-LD Organization /
 * MedicalBusiness / LocalBusiness name, and the domain head.
 */
export function extractBrandAliasesFromMeta(input: BrandAliasExtractionInput): UniversalSovContext {
	const targetUrl = (input.targetUrl || '').trim();
	const domain = input.domain || domainFromUrl(targetUrl);
	const entities = collectBrandEntities(seedFromExtraction(input));
	const schemaNames = normalizeBrandAliases(
		[input.organizationName, ...(input.schemaOrganizationNames ?? [])].filter((v): v is string => Boolean(v)),
		12,
	);
	const domainAliases = domainHeadAliases(domain || targetUrl);
	const brandAliases = normalizeBrandAliases(
		[entities.canonical, ...entities.aliases, ...schemaNames, ...domainAliases, input.ogSiteName || '', input.brandName || ''],
		40,
	);
	return {
		targetUrl,
		canonicalBrand: entities.canonical || brandAliases[0] || domainHeadFromHost(domain) || domain,
		domain,
		brandAliases,
		entities: {
			...entities,
			aliases: brandAliases,
			keys: [...new Set([...entities.keys, ...brandAliases.map(normalizeBrandAlias)].filter((k) => k.length >= 2))],
		},
	};
}

function isNegatedWindow(windowLower: string): boolean {
	return NEGATION_CUES.some((cue) => windowLower.includes(cue));
}

function hasPositiveAliasHit(hayLower: string, aliasLower: string): boolean {
	if (!aliasLower || aliasLower.length < 2) return false;
	let idx = hayLower.indexOf(aliasLower);
	while (idx !== -1) {
		const start = Math.max(0, idx - 40);
		const end = Math.min(hayLower.length, idx + aliasLower.length + 40);
		if (!isNegatedWindow(hayLower.slice(start, end))) return true;
		idx = hayLower.indexOf(aliasLower, idx + aliasLower.length);
	}
	return false;
}

/** True when any brand alias appears as a positive (non-negated) mention. */
export function textMentionsBrand(text: string | undefined | null, brandAliases: readonly string[]): boolean {
	const hay = (text || '').toLowerCase();
	if (!hay) return false;
	return brandAliases.some((alias) => {
		const folded = normalizeBrandAlias(alias);
		const raw = alias.toLowerCase();
		return hasPositiveAliasHit(hay, raw) || (folded.length >= 2 && hasPositiveAliasHit(hay.replace(/[^\p{L}\p{N}]+/gu, ''), folded));
	});
}

export function classifyCitationOwnership(input: CitationClassifyInput): ClassifiedCitation {
	const title = clean(input.title, 160);
	const url = (input.url || '').trim();
	const corpus = [title, input.snippet, input.body].filter(Boolean).join('\n');
	const owned = Boolean(url && input.targetUrl && (urlMatchesSite(url, input.targetUrl) || isOfficialCitationHost(hostnameFromUrl(url), input.targetUrl)));
	const mentioned = textMentionsBrand(corpus, input.brandAliases) || textMentionsBrand(url, input.brandAliases);
	let ownership: CitationOwnership;
	if (owned) ownership = 'owned';
	else if (mentioned) ownership = 'brand_earned';
	else ownership = 'unbranded_third_party';
	return {
		title: title || hostnameFromUrl(url) || url,
		url,
		isTargetMention: ownership === 'owned' || ownership === 'brand_earned',
		ownership,
	};
}

export function classifyCitations(
	citations: ReadonlyArray<{ title?: string; url?: string; snippet?: string; body?: string }>,
	targetUrl: string,
	brandAliases: readonly string[],
): ClassifiedCitation[] {
	const seen = new Set<string>();
	const out: ClassifiedCitation[] = [];
	for (const raw of citations) {
		const url = (raw.url || '').trim();
		if (!url && !raw.title) continue;
		const key = (url || raw.title || '').toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(
			classifyCitationOwnership({
				title: raw.title,
				url,
				snippet: raw.snippet,
				body: raw.body,
				targetUrl,
				brandAliases,
			}),
		);
	}
	return out;
}

export function toUniversalRank(clientRank?: number): UniversalSovRank {
	if (clientRank === 1 || clientRank === 2 || clientRank === 3) return clientRank;
	return 0;
}

/**
 * Brand-earned 3rd-party citations pull share out of the unbranded bucket
 * and into the target brand SoV weight.
 */
export function allocateCitationAwareShares(input: {
	own: number;
	thirdParty: number;
	rank1: number;
	rank2: number;
	citations: readonly ClassifiedCitation[];
}): { own: number; thirdParty: number; rank1: number; rank2: number } {
	const { citations } = input;
	if (!citations.length) {
		return { own: input.own, thirdParty: input.thirdParty, rank1: input.rank1, rank2: input.rank2 };
	}
	const earned = citations.filter((c) => c.ownership === 'brand_earned').length;
	const unbranded = citations.filter((c) => c.ownership === 'unbranded_third_party').length;
	const pool = earned + unbranded;
	if (pool <= 0) {
		return { own: input.own, thirdParty: input.thirdParty, rank1: input.rank1, rank2: input.rank2 };
	}
	const earnedShare = Math.round((input.thirdParty * earned) / pool);
	const own = input.own + earnedShare;
	const thirdParty = Math.max(0, input.thirdParty - earnedShare);
	const total = own + thirdParty + input.rank1 + input.rank2;
	if (total === 100) return { own, thirdParty, rank1: input.rank1, rank2: input.rank2 };
	const drift = 100 - total;
	return { own, thirdParty: Math.max(0, thirdParty + drift), rank1: input.rank1, rank2: input.rank2 };
}

export function buildUniversalQuerySov(input: UniversalQuerySovInput): UniversalQuerySov {
	const classified = classifyCitations(input.citations ?? [], input.context.targetUrl, input.context.brandAliases);
	const ranking = (input.leaderboard ?? []).filter((row) => !row.isThirdParty);
	const directory = (input.leaderboard ?? []).find((row) => row.isThirdParty);
	const rank1 = ranking.find((row) => row.rank === 1 && !row.isClient)?.share ?? ranking.find((row) => row.rank === 1)?.share ?? 0;
	const rank2 = ranking.find((row) => row.rank === 2 && !row.isClient)?.share ?? ranking.find((row) => row.rank === 2)?.share ?? 0;
	const allocated = allocateCitationAwareShares({
		own: input.asIsShare ?? 0,
		thirdParty: input.thirdPartyShare ?? directory?.share ?? 0,
		rank1,
		rank2,
		citations: classified,
	});
	const topCompetitors = ranking.slice(0, 3).map((row) => ({
		rank: row.rank,
		name: row.name,
		sharePercent: row.isClient ? allocated.own : row.rank === 1 ? allocated.rank1 : row.rank === 2 ? allocated.rank2 : row.share,
		isTarget: row.isClient === true,
	}));
	if (!topCompetitors.some((row) => row.isTarget) && input.context.canonicalBrand) {
		topCompetitors.push({
			rank: toUniversalRank(input.clientRank) || 0,
			name: input.context.canonicalBrand,
			sharePercent: allocated.own,
			isTarget: true,
		});
	}
	return {
		query: input.query,
		rank: toUniversalRank(input.clientRank),
		targetBrandScore: allocated.own,
		topCompetitors,
		thirdPartyShare: allocated.thirdParty,
		citations: classified.map(({ title, url, isTargetMention }) => ({ title, url, isTargetMention })),
	};
}

export const UNIVERSAL_QUERY_SOV_JSON_SCHEMA =
	'{"query":string,"rank":0|1|2|3,"targetBrandScore":number,"topCompetitors":[{"rank":number,"name":string,"sharePercent":number,"isTarget":boolean}],"thirdPartyShare":number,"citations":[{"title":string,"url":string,"isTargetMention":boolean}]}';

export function buildUniversalSovSystemPrompt(context: Pick<UniversalSovContext, 'targetUrl' | 'brandAliases' | 'canonicalBrand'>): string {
	const aliases = context.brandAliases.length ? context.brandAliases.join(', ') : context.canonicalBrand;
	return [
		'당신은 사이트에 종속되지 않는 범용 AI 검색 점유율(SoV) 분석기입니다.',
		`대상 공식 사이트(targetUrl): ${context.targetUrl || '(unknown)'}`,
		`대상 브랜드 별칭(brandAliases): [${aliases}]`,
		'인용(citation)은 다음 세 가지로만 분류하세요.',
		'1. Owned Citation: 출처 URL 호스트가 targetUrl 도메인과 일치.',
		'2. Brand Earned Citation: 네이버 블로그·지도·카페·티스토리 등 3자 채널이지만 본문/제목/스니펫에 brandAliases 중 하나 이상이 주체(Subject)로 추천·언급됨. 이 경우 isTargetMention=true 이고 자사 SoV에 합산.',
		'3. Unbranded Third-Party: 자사 브랜드 언급 없이 일반 정보나 경쟁사만 나열. isTargetMention=false.',
		'"언급되지 않음", "not mentioned" 등 부정 표현이 있으면 브랜드 문자열이 있어도 인용으로 보지 마세요.',
		'질의마다 1~3위와 SoV를 독립 집계하세요. 순위 밖이면 rank=0.',
		'targetBrandScore는 Owned + Brand Earned 비중(%), thirdPartyShare는 순수 비브랜드 분산(%).',
		'질의 유형: (1) Navigational/Brand = 질의에 brandAliases가 포함되면 자사 rank=1, targetBrandScore 85~95, 경쟁사 0~5, thirdPartyShare 5~15. (2) Specialized/Product = 고유 장비·상품명 질의는 실제 인용 여부로 40~70(인용) 또는 5~15(미인용). (3) Generic/Local = 상호 없는 일반 업종 질의는 3자 분산 40~60와 상위 경쟁사 실측 배분.',
		'브랜드 직검색에서 경쟁사를 1위로 두지 마세요. 이미 점유한 질의의 탈환 잠재력은 0~10입니다.',
		'반드시 순수 JSON 객체 하나만 응답하세요. 마크다운 펜스는 금지입니다.',
		`반환 형식(JSON): ${UNIVERSAL_QUERY_SOV_JSON_SCHEMA}`,
	].join(' ');
}

export function buildUniversalSovUserPrompt(input: {
	query: string;
	targetUrl: string;
	brandAliases: readonly string[];
	siteName?: string;
	location?: string;
	category?: string;
	responseText?: string;
	citationCandidates?: ReadonlyArray<{ title?: string; url?: string; snippet?: string }>;
}): string {
	const lines = [
		`질의(query): ${input.query}`,
		`대상 상호: ${input.siteName || input.brandAliases[0] || ''}`,
		`공식 사이트(targetUrl): ${input.targetUrl}`,
		`brandAliases: ${JSON.stringify(input.brandAliases)}`,
	];
	if (input.location) lines.push(`지역: ${input.location}`);
	if (input.category) lines.push(`업종: ${input.category}`);
	if (input.responseText) lines.push(`AI 응답 본문:\n${input.responseText.slice(0, 4000)}`);
	if (input.citationCandidates?.length) {
		lines.push('후보 출처:');
		for (const cite of input.citationCandidates.slice(0, 12)) {
			lines.push(`- ${cite.title || '(untitled)'} | ${cite.url || ''} | ${cite.snippet || ''}`);
		}
	}
	lines.push(`위 질의를 독립 분석하고 ${UNIVERSAL_QUERY_SOV_JSON_SCHEMA} 형식의 JSON만 반환하세요.`);
	return lines.join('\n');
}

export function isExternalUnbrandedHost(url: string, targetUrl: string): boolean {
	const host = hostnameFromUrl(url);
	if (!host) return false;
	if (isOfficialCitationHost(host, targetUrl)) return false;
	return isExternalCitationHost(host) || Boolean(targetUrl && !isOfficialCitationHost(host, targetUrl));
}

export function parseUniversalQuerySov(raw: unknown, fallbackQuery = ''): UniversalQuerySov | null {
	if (!raw || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	const query = typeof obj.query === 'string' ? obj.query : fallbackQuery;
	if (!query && !Array.isArray(obj.citations) && !Array.isArray(obj.topCompetitors)) return null;
	const rankNum = typeof obj.rank === 'number' ? obj.rank : Number.parseInt(String(obj.rank ?? ''), 10);
	const rank = rankNum === 1 || rankNum === 2 || rankNum === 3 ? rankNum : 0;
	const topCompetitors = Array.isArray(obj.topCompetitors)
		? obj.topCompetitors
				.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
				.map((row) => ({
					rank: Number(row.rank) || 0,
					name: typeof row.name === 'string' ? row.name : '',
					sharePercent: Number(row.sharePercent) || 0,
					isTarget: row.isTarget === true,
				}))
				.filter((row) => row.name)
		: [];
	const citations = Array.isArray(obj.citations)
		? obj.citations
				.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
				.map((row) => ({
					title: typeof row.title === 'string' ? row.title : '',
					url: typeof row.url === 'string' ? row.url : '',
					isTargetMention: row.isTargetMention === true,
				}))
				.filter((row) => row.url || row.title)
		: [];
	return {
		query,
		rank,
		targetBrandScore: Number.isFinite(Number(obj.targetBrandScore)) ? Number(obj.targetBrandScore) : 0,
		topCompetitors,
		thirdPartyShare: Number.isFinite(Number(obj.thirdPartyShare)) ? Number(obj.thirdPartyShare) : 0,
		citations,
	};
}

function clampShare(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : 0)));
}

function citationMix(citations: readonly ClassifiedCitation[] | undefined): { earned: number; unbranded: number } {
	if (!citations?.length) return { earned: 0, unbranded: 0 };
	return {
		earned: citations.filter((row) => row.ownership === 'owned' || row.ownership === 'brand_earned').length,
		unbranded: citations.filter((row) => row.ownership === 'unbranded_third_party').length,
	};
}

function finalizeQuerySovPie(
	partial: Omit<QuerySovShareTable, 'potentialGain'>,
): QuerySovShareTable {
	const own = clampShare(partial.own, 0, 100);
	const rank1 = clampShare(partial.rank1, 0, 100);
	const rank2 = clampShare(partial.rank2, 0, 100);
	let thirdParty = clampShare(partial.thirdParty, 0, 100);
	const drift = 100 - (own + rank1 + rank2 + thirdParty);
	thirdParty = Math.max(0, thirdParty + drift);
	const targetSov = clampShare(Math.max(own, partial.targetSov), own, 100);
	return {
		intent: partial.intent,
		clientRank: partial.clientRank,
		own,
		rank1,
		rank2,
		thirdParty,
		targetSov,
		potentialGain: targetSov - own,
	};
}

function liveRankOrUnranked(clientRank?: number): number {
	if (clientRank === 1 || clientRank === 2 || clientRank === 3) return clientRank;
	return 4;
}

/**
 * Intent-aware SoV pie. Percents come from query type + live rank + citation mix —
 * never from a fixed 27/16/5/52 table or hash jitter.
 */
export function computeIntentAwareSovShares(input: QuerySovShareInput): QuerySovShareTable {
	const brandTokens = input.brandTokens ?? [];
	const productTokens = input.productTokens ?? [];
	const intent = input.placeMonopoly
		? 'navigational'
		: classifyQuerySovIntent(input.query, brandTokens, productTokens);
	const { earned, unbranded } = citationMix(input.citations);
	const cited = input.cited === true || earned > 0;
	const liveRank = liveRankOrUnranked(input.clientRank);

	if (input.nicheLeadership) {
		const own = clampShare(84 + Math.min(6, earned) - Math.min(4, unbranded), 70, 95);
		const thirdParty = clampShare(10 + Math.min(6, unbranded), 5, 18);
		const leftover = Math.max(0, 100 - own - thirdParty);
		const rank1 = leftover > 0 ? Math.min(8, Math.max(0, Math.round(leftover * 0.55))) : 0;
		return finalizeQuerySovPie({
			intent: 'specialized',
			clientRank: 1,
			own,
			rank1,
			rank2: Math.max(0, leftover - rank1),
			thirdParty,
			targetSov: clampShare(own + Math.min(6, Math.max(0, 100 - own)), own, 98),
		});
	}

	if (intent === 'navigational') {
		const own = clampShare(90 + Math.min(5, earned) - Math.min(3, unbranded), 85, 95);
		const thirdParty = clampShare(8 + Math.min(5, unbranded) - Math.min(3, earned), 5, 15);
		const leftover = Math.max(0, 100 - own - thirdParty);
		const rank1 = leftover > 0 ? Math.min(5, Math.max(0, Math.round(leftover * 0.6))) : 0;
		const rank2 = Math.max(0, leftover - rank1);
		return finalizeQuerySovPie({
			intent,
			clientRank: 1,
			own,
			rank1,
			rank2,
			thirdParty,
			targetSov: clampShare(own + Math.min(8, Math.max(0, 100 - own)), own, 98),
		});
	}

	if (intent === 'specialized') {
		if (cited) {
			const clientRank = liveRank === 1 ? 1 : 2;
			const own =
				clientRank === 1
					? clampShare(62 + earned * 2, 40, 70)
					: clampShare(48 + earned * 2, 40, 70);
			const thirdParty = clampShare(18 - earned, 8, 25);
			const leftover = Math.max(0, 100 - own - thirdParty);
			const rank1 = Math.round(leftover * 0.58);
			return finalizeQuerySovPie({
				intent,
				clientRank,
				own,
				rank1,
				rank2: leftover - rank1,
				thirdParty,
				targetSov: clampShare(own + 12, own, 75),
			});
		}
		const own = clampShare(10 + earned * 2, 5, 15);
		const thirdParty = 48;
		const leftover = Math.max(0, 100 - own - thirdParty);
		const rank1 = Math.round(leftover * 0.62);
		return finalizeQuerySovPie({
			intent,
			clientRank: liveRank <= 3 ? liveRank : 4,
			own,
			rank1,
			rank2: leftover - rank1,
			thirdParty,
			targetSov: clampShare(own + 28, 30, 55),
		});
	}

	const thirdParty = clampShare(50 - earned * 3 + unbranded, 40, 60);
	let own: number;
	if (liveRank === 1) own = clampShare((100 - thirdParty) * 0.5, 20, 45);
	else if (liveRank === 2) own = clampShare((100 - thirdParty) * 0.32, 12, 28);
	else if (liveRank === 3) own = clampShare((100 - thirdParty) * 0.18, 8, 18);
	else own = clampShare(10 + Math.min(5, earned), 5, 15);
	const leftover = Math.max(0, 100 - own - thirdParty);
	const rank1 = Math.round(leftover * 0.62);
	return finalizeQuerySovPie({
		intent,
		clientRank: liveRank,
		own,
		rank1,
		rank2: leftover - rank1,
		thirdParty,
		targetSov: clampShare(own + Math.round(thirdParty * 0.45), own + 10, 55),
	});
}
