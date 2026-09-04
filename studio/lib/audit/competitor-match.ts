/**
 * Shared SoV competitor matching: collapse self-brand variants into one slot
 * and fill remaining 1–3 ranks with same-category peers.
 */

import {
	collectBrandEntities,
	isSameBrandEntity,
	type BrandEntitySeed,
	type BrandEntitySet,
} from '@/lib/geo/brand-entities';
import {
	detectSovIndustryFamily,
	isOffIndustryListing,
	looksLikePlaceOrBuildingQuery,
	nearbyIndustryPeerLabels,
	resolveTargetIndustry,
} from '@/lib/audit/sov-industry-guard';
import {
	genericSearchDispersionLabels,
	isGenericNonNicheCompetitor,
	resolveNicheOfferingMatch,
} from '@/lib/audit/sov-niche-entity';

export type CompetitorMatchLang = 'ko' | 'en';

export interface CompetitorMatchInput {
	clientName: string;
	rankedNames?: readonly string[];
	query?: string;
	categoryName?: string;
	mainService?: string;
	region?: string;
	lang?: CompetitorMatchLang;
	brandAliases?: readonly string[];
	brandSeed?: BrandEntitySeed;
	industryType?: string;
	schemaTypes?: readonly string[];
	productTokens?: readonly string[];
	offerings?: readonly string[];
	offeringCorpus?: string;
}

export interface RankedCompetitorSlot {
	name: string;
	isClient: boolean;
	isRealData: boolean;
}

export interface CompetitorMatchResult {
	/** Deduped live listings, self-variants collapsed. */
	unifiedNames: string[];
	/** 0-based client index in `unifiedNames`; -1 when absent. */
	clientIndex: number;
	/** 1–3 display slots (self at most once; peers fill the rest). */
	slots: RankedCompetitorSlot[];
	entities: BrandEntitySet;
	/** Building/floor query where the target is the only same-industry occupant. */
	placeMonopoly: boolean;
	targetIndustry: string;
	nicheLeadership: boolean;
	nicheItemToken: string;
	hasNicheItem: boolean;
}

const CATEGORY_PEER_RULES: Array<{
	test: RegExp;
	ko: readonly string[];
	en: readonly string[];
}> = [
	{
		test: /섭외|행사|이벤트|에이전시|연예인|현장\s*운영|기획|대행|casting|talent|event|agency/i,
		ko: ['위드이엔씨', '이벤트바인', '스타마케팅코리아', '더블유이엔티', '케이이엔엠'],
		en: ['WITH ENC', 'Event Vine', 'Star Marketing Korea', 'W ENT', 'K E&M'],
	},
	{
		test: /치과|임플란트|교정|dental|implant/i,
		ko: ['서울바른치과', '메디치과의원', '스마일치과의원'],
		en: ['Seoul Barun Dental', 'Medi Dental Clinic', 'Smile Dental'],
	},
	{
		test: /피부과|피부시술|리프팅|dermatolog|skin/i,
		ko: ['미담한의원', '예일의원', '준피부과의원'],
		en: ['Midam Clinic', 'Yale Clinic', 'Jun Dermatology'],
	},
	{
		test: /도수|추나|재활|정형|통증|manual|rehab|ortho/i,
		ko: ['본정형외과', '튼튼재활의학과', '바른통증의학과'],
		en: ['Bon Orthopedics', 'Teunteun Rehab', 'Barun Pain Clinic'],
	},
	{
		test: /법률|변호사|법무|law|attorney|legal/i,
		ko: ['법무법인 바른', '법무법인 태평양', '법무법인 광장'],
		en: ['Barun Law', 'Bae Kim & Lee', 'Lee & Ko'],
	},
];

const REGION_PEER_RULES: Array<{
	region: RegExp;
	industry: RegExp;
	ko: readonly string[];
	en: readonly string[];
}> = [
	{
		region: /대구|동구|신천|동대구역/,
		industry: /피부|성형|미용|에스테틱|dermatol|plastic|aesthetic|clinic|의원|의료/,
		ko: ['신천고운피부과의원', '동대구역피부과의원', '더페이스의원 대구점'],
		en: ['Sincheon Dermatology Clinic', 'Dongdaegu Dermatology Clinic', 'The Face Clinic Daegu'],
	},
];

function cleanName(value: string | null | undefined): string {
	return (value || '')
		.replace(/<[^>]*>?/g, '')
		.replace(/&amp;/gi, '&')
		.replace(/&nbsp;/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function matchCorpus(input: CompetitorMatchInput): string {
	return [input.query, input.categoryName, input.mainService].filter(Boolean).join(' ');
}

export function resolveBrandEntities(input: CompetitorMatchInput): BrandEntitySet {
	const seeded = collectBrandEntities({
		brandName: input.clientName,
		...(input.brandSeed ?? {}),
		personNames: [...(input.brandSeed?.personNames ?? []), ...(input.brandAliases ?? [])],
	});
	const extra = (input.brandAliases ?? []).filter(Boolean);
	const aliases = [...new Set([...seeded.aliases, ...extra, input.clientName].filter(Boolean))];
	const keys = [...new Set([...seeded.keys, ...aliases.map((a) => a.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase())])];
	return { ...seeded, aliases, keys };
}

export function isSelfListing(name: string, entities: BrandEntitySet): boolean {
	const cleaned = cleanName(name);
	if (!cleaned) return false;
	if (entities.canonical && isSameBrandEntity(cleaned, entities.canonical, entities.aliases)) return true;
	return entities.aliases.some((alias) => isSameBrandEntity(cleaned, alias));
}

export function collapseSelfVariants(
	names: readonly string[],
	entities: BrandEntitySet,
	canonicalName: string,
): string[] {
	const out: string[] = [];
	let selfPlaced = false;
	for (const raw of names) {
		const cleaned = cleanName(raw);
		if (!cleaned) continue;
		if (isSelfListing(cleaned, entities)) {
			if (selfPlaced) continue;
			out.push(canonicalName || cleaned);
			selfPlaced = true;
			continue;
		}
		if (out.some((existing) => isSameBrandEntity(existing, cleaned))) continue;
		out.push(cleaned);
	}
	return out;
}

export function categoryPeerNames(
	query: string,
	lang: CompetitorMatchLang = 'ko',
	limit = 4,
	region = '',
): string[] {
	const corpus = query || '';
	const loc = region || '';
	for (const rule of REGION_PEER_RULES) {
		if (!rule.region.test(`${loc} ${corpus}`) || !rule.industry.test(corpus)) continue;
		return [...(lang === 'en' ? rule.en : rule.ko)].slice(0, limit);
	}
	for (const rule of CATEGORY_PEER_RULES) {
		if (!rule.test.test(corpus)) continue;
		return [...(lang === 'en' ? rule.en : rule.ko)].slice(0, limit);
	}
	return [];
}

function fillCategoryPeers(
	others: readonly string[],
	entities: BrandEntitySet,
	input: CompetitorMatchInput,
	need: number,
): string[] {
	if (need <= 0) return [...others];
	const lang: CompetitorMatchLang = input.lang === 'en' ? 'en' : 'ko';
	const niche = resolveNicheOfferingMatch({
		query: input.query,
		region: input.region,
		categoryName: input.categoryName,
		mainService: input.mainService,
		productTokens: input.productTokens,
		offerings: input.offerings,
		offeringCorpus: input.offeringCorpus,
		lang,
	});
	const peers = niche.isNicheQuery
		? [...genericSearchDispersionLabels(lang, niche.nicheItemToken)]
		: [
				...categoryPeerNames(matchCorpus(input), lang, 6, input.region),
				...nearbyIndustryPeerLabels(
					{
						categoryName: input.categoryName,
						mainService: input.mainService,
						region: input.region,
						query: input.query,
						industryType: input.industryType,
						schemaTypes: input.schemaTypes,
						lang,
					},
					lang,
					2,
				),
			];
	const out = [...others];
	for (const peer of peers) {
		if (out.length >= others.length + need) break;
		if (isSelfListing(peer, entities)) continue;
		if (out.some((existing) => isSameBrandEntity(existing, peer))) continue;
		out.push(peer);
	}
	return out;
}

/**
 * Shared 1–3 rank composer: one 자사 slot max, remaining slots are distinct
 * same-category competitors (live first, category-peer simulation as fill).
 */
export function matchCompetitorRoster(input: CompetitorMatchInput): CompetitorMatchResult {
	const entities = resolveBrandEntities(input);
	const canonical = cleanName(input.clientName) || entities.canonical;
	const industryCtx = {
		categoryName: input.categoryName,
		mainService: input.mainService,
		region: input.region,
		query: input.query,
		industryType: input.industryType,
		schemaTypes: input.schemaTypes,
		lang: input.lang,
	};
	const target = resolveTargetIndustry(industryCtx);
	const family = detectSovIndustryFamily(industryCtx);
	const niche = resolveNicheOfferingMatch({
		query: input.query,
		region: input.region,
		categoryName: input.categoryName,
		mainService: input.mainService,
		productTokens: input.productTokens,
		offerings: input.offerings,
		offeringCorpus: input.offeringCorpus,
		lang: input.lang,
	});
	const industryGuarded = (input.rankedNames ?? []).filter(
		(name) => !isOffIndustryListing(name, family, '', industryCtx),
	);
	const guardedRanked = niche.isNicheQuery
		? industryGuarded.filter(
				(name) => isSelfListing(name, entities) || !isGenericNonNicheCompetitor(name, niche.nicheItemTokens),
			)
		: industryGuarded;
	let unifiedNames = collapseSelfVariants(guardedRanked, entities, canonical);
	const placeQuery = looksLikePlaceOrBuildingQuery(input.query || '', industryCtx);
	if (placeQuery || niche.nicheLeadership) {
		const livePeers = unifiedNames.filter((name) => !isSelfListing(name, entities));
		if (livePeers.length === 0 || niche.nicheLeadership) {
			unifiedNames = [canonical, ...livePeers.filter((name) => !isSelfListing(name, entities))];
		}
	}
	const clientIndex = unifiedNames.findIndex((name) => isSelfListing(name, entities));
	const liveOthers = unifiedNames.filter((name) => !isSelfListing(name, entities));
	const others = fillCategoryPeers(liveOthers, entities, input, Math.max(0, 2 - liveOthers.length));
	const liveSet = new Set(liveOthers.map((name) => name.replace(/\s+/g, '').toLowerCase()));

	const slots: RankedCompetitorSlot[] = [];
	let otherCursor = 0;
	const pushOther = () => {
		const name = others[otherCursor++];
		if (!name) return;
		slots.push({
			name,
			isClient: false,
			isRealData: liveSet.has(name.replace(/\s+/g, '').toLowerCase()),
		});
	};

	if (clientIndex !== -1 && clientIndex < 3) {
		for (let i = 0; i < 3; i++) {
			if (i === clientIndex) {
				slots.push({ name: canonical, isClient: true, isRealData: true });
			} else {
				pushOther();
			}
		}
	} else {
		pushOther();
		pushOther();
	}

	const placeMonopoly = placeQuery && liveOthers.length === 0 && clientIndex === 0 && !niche.nicheLeadership;
	return {
		unifiedNames,
		clientIndex,
		slots: slots.slice(0, 3),
		entities,
		placeMonopoly,
		targetIndustry: target.label,
		nicheLeadership: niche.nicheLeadership,
		nicheItemToken: niche.nicheItemToken,
		hasNicheItem: niche.hasNicheItem,
	};
}
