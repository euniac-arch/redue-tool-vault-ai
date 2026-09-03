/**
 * Universal niche-entity matching for SoV.
 * Isolates equipment / signature-service tokens from a query, checks whether
 * the audited site actually offers them, and drops generic chain brands that
 * do not evidence the same item.
 */

import { isSpecializedProductToken } from '@/lib/audit/universal-sov-engine';

export type SovNicheLang = 'ko' | 'en';

export type SovNicheContext = {
	query?: string;
	region?: string;
	categoryName?: string;
	mainService?: string;
	productTokens?: readonly string[];
	offerings?: readonly string[];
	offeringCorpus?: string;
	lang?: SovNicheLang;
};

export type NicheOfferingMatch = {
	nicheItemToken: string;
	nicheItemTokens: string[];
	hasNicheItem: boolean;
	isNicheQuery: boolean;
	nicheLeadership: boolean;
};

const GENERIC_INTENT =
	/추천|잘하는곳|잘하는|후기|가격|예약|근처|인근|입점|베스트|best|recommended|near|where/i;
const REGION_SUFFIX = /(?:특별시|광역시|특별자치시|특별자치도|자치구|시|군|구|동|읍|면|리|역)$/;
const GENERIC_PROCEDURE =
	/^(리프팅|레이저|보톡스|필러|임플란트|교정|스케일링|커트|펌|염색|상담|시술|치료|검진|관리|메뉴)$/i;
const GENERIC_CHAIN =
	/대학병원|세브란스|아산병원|삼성서울|서울대병원|성모병원|전국\s*체인|프랜차이즈|준피부과|미담한의원|예일의원|본정형외과|튼튼재활/i;

function fold(value: string | null | undefined): string {
	return (value || '').replace(/[\s\-_.]/g, '').toLowerCase();
}

function clean(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
	return clean(value)
		.replace(/^#/, '')
		.split(/[\s/#,|+]+/)
		.map((token) => token.trim())
		.filter(Boolean);
}

function queryContainsToken(query: string, token: string): boolean {
	const q = fold(query);
	const t = fold(token);
	if (!q || t.length < 2) return false;
	return q.includes(t);
}

function corpusHasToken(corpus: string, token: string): boolean {
	const c = fold(corpus);
	const t = fold(token);
	if (!c || t.length < 2) return false;
	if (c.includes(t)) return true;
	return t.length >= 6 && t.includes(c) && c.length >= 4;
}

export function extractNicheItemTokens(query: string, ctx: SovNicheContext = {}): string[] {
	const raw = clean(query).replace(/^#/, '');
	if (!raw) return [];
	const regionBits = new Set(tokenize(ctx.region || '').map((token) => fold(token)));
	const industryBits = new Set(
		tokenize([ctx.categoryName, ctx.mainService].filter(Boolean).join(' ')).map((token) => fold(token)),
	);
	const fromProducts = (ctx.productTokens ?? [])
		.map((token) => clean(token))
		.filter((token) => token.length >= 2 && queryContainsToken(raw, token));
	const fromQuery = tokenize(raw).filter((token) => {
		const key = fold(token);
		if (key.length < 2) return false;
		if (regionBits.has(key) || industryBits.has(key)) return false;
		if (REGION_SUFFIX.test(token) && token.length <= 4) return false;
		if (GENERIC_INTENT.test(token) || GENERIC_PROCEDURE.test(token)) return false;
		return isSpecializedProductToken(token);
	});
	const seen = new Set<string>();
	const out: string[] = [];
	for (const token of [...fromProducts, ...fromQuery]) {
		const key = fold(token);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(token);
	}
	return out;
}

export function resolveNicheOfferingMatch(ctx: SovNicheContext): NicheOfferingMatch {
	const query = clean(ctx.query);
	const tokens = extractNicheItemTokens(query, ctx);
	const offeringCorpus = [
		ctx.offeringCorpus,
		...(ctx.offerings ?? []),
		...(ctx.productTokens ?? []),
	]
		.filter(Boolean)
		.join(' ');
	const matched = tokens.filter((token) => corpusHasToken(offeringCorpus, token));
	const hasNicheItem = matched.length > 0;
	return {
		nicheItemToken: matched[0] || tokens[0] || '',
		nicheItemTokens: tokens,
		hasNicheItem,
		isNicheQuery: tokens.length > 0,
		nicheLeadership: hasNicheItem,
	};
}

export function listingMentionsNiche(name: string, tokens: readonly string[]): boolean {
	return tokens.some((token) => queryContainsToken(name, token));
}

export function isGenericNonNicheCompetitor(name: string, tokens: readonly string[]): boolean {
	const listing = clean(name);
	if (!listing || listingMentionsNiche(listing, tokens)) return false;
	if (GENERIC_CHAIN.test(listing)) return true;
	if (/일반 검색 분산|미확인 노출|Generic search noise|Unverified/i.test(listing)) return false;
	if (/인근 동종|반경 3km|Nearby .+ within 3km|area /i.test(listing)) return true;
	return /의원|병원|클리닉|법률사무소|법무법인|학원|식당|카페|샵|salon|clinic|hospital|law/i.test(listing);
}

export function filterGenericNonNicheNames(names: readonly string[], tokens: readonly string[]): string[] {
	if (!tokens.length) return [...names];
	return names.filter((name) => !isGenericNonNicheCompetitor(name, tokens));
}

export function genericSearchDispersionLabels(
	lang: SovNicheLang = 'ko',
	nicheItemToken = '',
): [string, string] {
	const item = clean(nicheItemToken);
	if (lang === 'en') {
		return ['Generic search noise', item ? `Unverified ${item} listing` : 'Unverified category listing'];
	}
	return ['일반 검색 분산', item ? `${item} 미확인 노출` : '특화 항목 미확인 노출'];
}

export function buildNicheLeadershipInsight(
	region: string,
	nicheItemToken: string,
	lang: SovNicheLang = 'ko',
): string {
	const loc = clean(region) || (lang === 'en' ? 'this area' : '해당 권역');
	const item = clean(nicheItemToken) || (lang === 'en' ? 'this specialty' : '해당 특화 항목');
	if (lang === 'en') {
		return `${loc}: the audited site offers “${item}” and leads search share for this specialty.`;
	}
	return `해당 권역 내 ${item} 특화 서비스/장비 보유 및 검색 점유율 우위 (${loc})`;
}

export function buildSovNichePromptGuide(ctx: SovNicheContext): string {
	const match = resolveNicheOfferingMatch(ctx);
	const query = clean(ctx.query);
	const token = match.nicheItemToken || '(none)';
	return [
		'[지침 - 고유 특화 서비스/장비 키워드 분석 규칙]:',
		`1. 키워드에 특정 장비명, 고유 시술명, 특화 상품/기술명이 포함된 경우 단순 일반 브랜드의 인지도나 트래픽만으로 순위를 매기지 말 것. (nicheItemToken: ${token}, query: ${query})`,
		'2. 분석 대상(Target)이 해당 특화 항목을 웹사이트에 공식 서비스/메뉴로 보유하고 있다면 타겟의 전문성과 선점 지위를 최우선(1위)으로 반영할 것.',
		'3. 해당 특화 항목을 실제로 취급/마케팅하는지 확인되지 않는 일반 대형 경쟁사는 1~3위 경쟁사에서 배제하거나 \'일반 검색 분산\'으로 처리할 것.',
	].join('\n');
}
