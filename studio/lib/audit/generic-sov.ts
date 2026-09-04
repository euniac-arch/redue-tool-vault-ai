/**
 * Industry-agnostic Share of Voice engine.
 *
 * Decomposes a query into Location / Core Entity / Intent, then scores each
 * candidate with:
 *   RawScore(i) = (RankWeight(i) * EntityMatchScore(i)) + (AICitationCount(i) * CitationWeight)
 *   SoV(%)      = RawScore(i) / Σ RawScore * 100
 *
 * When a concrete core entity is present (equipment, branded procedure,
 * signature amenity, legal specialty, …) `strictEntityCheck` is on and
 * listings that never mention that entity are locked to 0.05 and dropped
 * from the top-3 leaderboard.
 */

import { foldEntityKey } from '@/lib/geo/brand-entities';
import { isSpecializedProductToken } from '@/lib/audit/universal-sov-engine';

export const GENERIC_SOV_RANK_WEIGHTS = [10, 7, 5, 3, 2, 1] as const;
export const GENERIC_SOV_CITATION_WEIGHT = 3;
export const ENTITY_MATCH_EXACT = 1;
export const ENTITY_MATCH_PARTIAL = 0.5;
export const ENTITY_MATCH_NONE = 0.05;
export const CORE_ENTITY_MIN_LENGTH = 3;

export type EntityMatchKind = 'exact' | 'partial' | 'none';

export type QueryEntityDecomposition = {
	query: string;
	locations: string[];
	coreEntities: string[];
	intents: string[];
	remainder: string[];
	/** True when the query names a concrete 3+ char proper noun / equipment / specialty. */
	strictEntityCheck: boolean;
};

export type SovSearchHit = {
	name: string;
	rank?: number;
	title?: string;
	snippet?: string;
	body?: string;
	aiCitationCount?: number;
};

export type GenericSovCandidate = SovSearchHit & {
	id?: string;
	isClient?: boolean;
	/** Audited site officially lists the core entity (menu / equipment / specialty). */
	holdsCoreEntity?: boolean;
};

export type GenericSovInput = {
	targetQuery: string;
	candidates: readonly GenericSovCandidate[];
	region?: string;
	categoryName?: string;
	mainService?: string;
	productTokens?: readonly string[];
	brandTokens?: readonly string[];
	citationWeight?: number;
	/** Precomputed decomposition — recomputed from `targetQuery` when omitted. */
	decomposition?: QueryEntityDecomposition;
};

export type GenericSovScore = {
	id: string;
	name: string;
	isClient: boolean;
	serpRank: number;
	rankWeight: number;
	entityMatch: EntityMatchKind;
	entityMatchScore: number;
	aiCitationCount: number;
	rawScore: number;
	sovPercent: number;
	/** Locked out of the 1–3 board (no core-entity evidence under strict mode). */
	excludedFromTop3: boolean;
};

export type GenericSovResult = {
	query: QueryEntityDecomposition;
	scores: GenericSovScore[];
	/** Eligible 1–3 rows, highest RawScore first. Client is included when eligible. */
	leaderboard: GenericSovScore[];
	totalRawScore: number;
	clientRank: number;
};

export type QueryEntityOptions = {
	region?: string;
	categoryName?: string;
	mainService?: string;
	productTokens?: readonly string[];
	brandTokens?: readonly string[];
};

const INTENT_TOKEN =
	/^(추천|잘하는곳|잘하는|후기|가격|비용|예약|근처|인근|입점|베스트|리뷰|비교|순위|정보|안내|best|recommended|recommend|near|where|review|price|cost|vs)$/i;

const REGION_SUFFIX = /(?:특별시|광역시|특별자치시|특별자치도|자치구|시|군|구|동|읍|면|리|역)$/;

const METRO_OR_PROVINCE =
	/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|강남|서초|송파|분당|해운대|수원|성남|용인|고양|청주|전주|포항|창원|seoul|busan|daegu|incheon|gwangju|daejeon|ulsan|jeju|gangnam)$/i;

const GENERIC_INDUSTRY_NOUN =
	/^(내과|외과|치과|피부과|피부미용|피부시술|성형외과|정형외과|한의원|병원|의원|클리닉|약국|학원|학교|맛집|카페|식당|레스토랑|뷔페|펜션|호텔|숙박|리조트|부동산|법률|변호사|법무|세무|회계|인테리어|헬스|피트니스|미용|살롱|샵|동물병원|에이전시|도수치료|추나치료|clinic|hospital|dental|hotel|pension|restaurant|cafe|salon|gym|law|agency)$/i;

const GENERIC_PROCEDURE_NOUN =
	/^(리프팅|레이저|보톡스|필러|스케일링|커트|펌|염색|상담|시술|치료|검진|관리|메뉴|솔루션|서비스|프로그램)$/i;

const STANDALONE_MODIFIER = /^(엘리트|플러스|프로|프리미엄|스페셜|시리즈|elite|plus|pro|premium)$/i;

const GENERIC_VERTICAL_LISTING =
	/의원|병원|클리닉|피부과|성형외과|치과|한의원|정형외과|법률사무소|법무법인|학원|식당|카페|펜션|호텔|샵|salon|clinic|hospital|law|pension|hotel/i;

function clean(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function fold(value: string | null | undefined): string {
	return foldEntityKey(value || '');
}

function tokenize(value: string): string[] {
	return clean(value)
		.replace(/^#/, '')
		.split(/[\s/#,|+·•]+/)
		.map((token) => token.trim())
		.filter(Boolean);
}

function uniquePreserve(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const display = clean(raw);
		const key = fold(display);
		if (!display || !key || seen.has(key)) continue;
		seen.add(key);
		out.push(display);
	}
	return out;
}

function isLocationToken(token: string, regionBits: ReadonlySet<string>): boolean {
	const key = fold(token);
	if (!key) return false;
	if (regionBits.has(key) || METRO_OR_PROVINCE.test(token)) return true;
	return REGION_SUFFIX.test(token) && token.length <= 5;
}

function isIntentToken(token: string): boolean {
	return INTENT_TOKEN.test(token.replace(/\s+/g, ''));
}

function isGenericIndustryOrProcedure(token: string): boolean {
	const compact = token.replace(/\s+/g, '');
	return GENERIC_INDUSTRY_NOUN.test(compact) || GENERIC_PROCEDURE_NOUN.test(compact);
}

function isConcreteCoreEntity(token: string): boolean {
	const compact = token.replace(/\s+/g, '');
	if (compact.length < CORE_ENTITY_MIN_LENGTH) return false;
	if (STANDALONE_MODIFIER.test(compact)) return false;
	if (isGenericIndustryOrProcedure(compact) || isIntentToken(compact)) return false;
	if (isSpecializedProductToken(compact)) return true;
	if (/[가-힣]{3,}/.test(compact) && !GENERIC_INDUSTRY_NOUN.test(compact)) return true;
	if (/[A-Za-z]{4,}/.test(compact) && !GENERIC_INDUSTRY_NOUN.test(compact)) return true;
	return false;
}

export function rankWeightFor(rank: number): number {
	if (!Number.isFinite(rank) || rank < 1) return GENERIC_SOV_RANK_WEIGHTS[GENERIC_SOV_RANK_WEIGHTS.length - 1];
	const index = Math.min(Math.round(rank) - 1, GENERIC_SOV_RANK_WEIGHTS.length - 1);
	return GENERIC_SOV_RANK_WEIGHTS[index];
}

export function normalizeSovSearchHits(
	raw: ReadonlyArray<string | SovSearchHit> | null | undefined,
): SovSearchHit[] {
	const out: SovSearchHit[] = [];
	const seen = new Set<string>();
	for (const [index, item] of (raw ?? []).entries()) {
		const hit: SovSearchHit =
			typeof item === 'string'
				? { name: clean(item), rank: index + 1 }
				: {
						name: clean(item.name),
						rank: item.rank && item.rank > 0 ? item.rank : index + 1,
						title: clean(item.title) || undefined,
						snippet: clean(item.snippet) || undefined,
						body: clean(item.body) || undefined,
						aiCitationCount: Math.max(0, Math.round(Number(item.aiCitationCount) || 0)),
					};
		const key = fold(hit.name);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(hit);
	}
	return out;
}

/**
 * Split `targetQuery` into location / core entity / intent.
 * Industry-agnostic: a 3+ char proper noun that is not a generic vertical
 * (피부과, 펜션, 법률, …) becomes a core entity and turns strict mode on.
 */
export function decomposeQueryEntity(
	targetQuery: string,
	options: QueryEntityOptions = {},
): QueryEntityDecomposition {
	const query = clean(targetQuery).replace(/^#/, '');
	const regionBits = new Set(tokenize(options.region || '').map((token) => fold(token)));
	const industryBits = new Set(
		tokenize([options.categoryName, options.mainService].filter(Boolean).join(' ')).map((token) => fold(token)),
	);
	const locations: string[] = [];
	const intents: string[] = [];
	const remainder: string[] = [];
	const fromQuery: string[] = [];

	for (const token of tokenize(query)) {
		if (isLocationToken(token, regionBits)) {
			locations.push(token);
			continue;
		}
		if (isIntentToken(token)) {
			intents.push(token);
			continue;
		}
		const key = fold(token);
		if (industryBits.has(key) || isGenericIndustryOrProcedure(token)) {
			remainder.push(token);
			continue;
		}
		if (isConcreteCoreEntity(token)) {
			fromQuery.push(token);
			continue;
		}
		remainder.push(token);
	}

	const brandBits = new Set((options.brandTokens ?? []).map((token) => fold(token)).filter((key) => key.length >= 2));
	const fromProducts = (options.productTokens ?? [])
		.map((token) => clean(token))
		.filter((token) => token.length >= CORE_ENTITY_MIN_LENGTH && fold(query).includes(fold(token)));

	const coreEntities = uniquePreserve([...fromProducts, ...fromQuery]).filter((token) => {
		const key = fold(token);
		if (key.length < CORE_ENTITY_MIN_LENGTH) return false;
		if (brandBits.has(key)) return false;
		return ![...brandBits].some((brand) => brand.length >= 2 && (key.includes(brand) || brand.includes(key)));
	});

	return {
		query,
		locations: uniquePreserve(locations),
		coreEntities,
		intents: uniquePreserve(intents),
		remainder: uniquePreserve(remainder),
		strictEntityCheck: coreEntities.length > 0,
	};
}

function mentionKind(haystack: string, entity: string): EntityMatchKind {
	const hay = fold(haystack);
	const needle = fold(entity);
	if (!hay || needle.length < 2) return 'none';
	if (hay.includes(needle)) return 'exact';
	if (needle.length >= 6) {
		const stem = needle.slice(0, Math.max(4, Math.ceil(needle.length * 0.65)));
		if (stem.length >= 4 && hay.includes(stem)) return 'partial';
	}
	if (needle.length >= 6 && needle.includes(hay) && hay.length >= 4) return 'partial';
	return 'none';
}

export function scoreEntityMatch(
	text: string,
	coreEntities: readonly string[],
	holdsCoreEntity = false,
): { kind: EntityMatchKind; score: number } {
	if (!coreEntities.length) return { kind: 'exact', score: ENTITY_MATCH_EXACT };
	if (holdsCoreEntity) return { kind: 'exact', score: ENTITY_MATCH_EXACT };
	let best: EntityMatchKind = 'none';
	for (const entity of coreEntities) {
		const kind = mentionKind(text, entity);
		if (kind === 'exact') return { kind, score: ENTITY_MATCH_EXACT };
		if (kind === 'partial') best = 'partial';
	}
	if (best === 'partial') return { kind: 'partial', score: ENTITY_MATCH_PARTIAL };
	return { kind: 'none', score: ENTITY_MATCH_NONE };
}

export function candidateEvidenceText(candidate: GenericSovCandidate): string {
	return [candidate.name, candidate.title, candidate.snippet, candidate.body].filter(Boolean).join(' ');
}

export function looksLikeGenericVerticalListing(name: string): boolean {
	return GENERIC_VERTICAL_LISTING.test(clean(name));
}

function roundSharesTo100(values: number[]): number[] {
	if (!values.length) return [];
	const rounded = values.map((value) => Math.max(0, Math.round(value)));
	let drift = 100 - rounded.reduce((sum, value) => sum + value, 0);
	if (drift === 0) return rounded;
	const order = values
		.map((value, index) => ({ index, frac: value - Math.floor(value) }))
		.sort((a, b) => (drift > 0 ? b.frac - a.frac : a.frac - b.frac));
	for (const row of order) {
		if (drift === 0) break;
		const next = rounded[row.index] + Math.sign(drift);
		if (next < 0) continue;
		rounded[row.index] = next;
		drift -= Math.sign(drift);
	}
	return rounded;
}

/**
 * Pure SoV calculator. Generic keywords (no core entity) keep EntityMatch=1.0
 * for every candidate so rank + AI citations alone decide the pie.
 */
export function calculateGenericSoV(input: GenericSovInput): GenericSovResult {
	const query =
		input.decomposition ??
		decomposeQueryEntity(input.targetQuery, {
			region: input.region,
			categoryName: input.categoryName,
			mainService: input.mainService,
			productTokens: input.productTokens,
			brandTokens: input.brandTokens,
		});
	const citationWeight =
		Number.isFinite(input.citationWeight) && Number(input.citationWeight) >= 0
			? Number(input.citationWeight)
			: GENERIC_SOV_CITATION_WEIGHT;

	const scored: GenericSovScore[] = input.candidates.map((candidate, index) => {
		const name = clean(candidate.name);
		const serpRank = candidate.rank && candidate.rank > 0 ? candidate.rank : index + 1;
		const rankWeight = rankWeightFor(serpRank);
		const match = query.strictEntityCheck
			? scoreEntityMatch(candidateEvidenceText(candidate), query.coreEntities, candidate.holdsCoreEntity === true)
			: { kind: 'exact' as const, score: ENTITY_MATCH_EXACT };
		const aiCitationCount = Math.max(0, Math.round(Number(candidate.aiCitationCount) || 0));
		const rawScore = rankWeight * match.score + aiCitationCount * citationWeight;
		const excludedFromTop3 =
			query.strictEntityCheck && match.kind === 'none' && candidate.isClient !== true;
		return {
			id: candidate.id || `cand-${index}`,
			name,
			isClient: candidate.isClient === true,
			serpRank,
			rankWeight,
			entityMatch: match.kind,
			entityMatchScore: match.score,
			aiCitationCount,
			rawScore,
			sovPercent: 0,
			excludedFromTop3,
		};
	});

	const eligible = scored.filter((row) => !row.excludedFromTop3);
	const totalRawScore = eligible.reduce((sum, row) => sum + row.rawScore, 0);
	if (totalRawScore > 0) {
		const rawPercents = eligible.map((row) => (row.rawScore / totalRawScore) * 100);
		const normalized = roundSharesTo100(rawPercents);
		eligible.forEach((row, index) => {
			row.sovPercent = normalized[index] ?? 0;
		});
	} else {
		const even = eligible.length ? roundSharesTo100(eligible.map(() => 100 / eligible.length)) : [];
		eligible.forEach((row, index) => {
			row.sovPercent = even[index] ?? 0;
		});
	}

	const leaderboard = [...eligible]
		.filter((row) => row.name)
		.sort((a, b) => {
			if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore;
			if (a.isClient !== b.isClient) return a.isClient ? -1 : 1;
			return a.serpRank - b.serpRank;
		})
		.slice(0, 3);

	const clientIndex = leaderboard.findIndex((row) => row.isClient);
	const clientRank = clientIndex === -1 ? 4 : clientIndex + 1;

	return {
		query,
		scores: scored,
		leaderboard,
		totalRawScore,
		clientRank,
	};
}

export type GenericSovShareAllocation = {
	own: number;
	rank1: number;
	rank2: number;
	thirdParty: number;
	clientRank: number;
	usedGenericScores: boolean;
};

const SPECIALIZED_THIRD_PARTY = 12;

/**
 * Map scored candidates onto the 1–3 + 3rd-party pie.
 * Returns `null` when nobody evidenced the core entity so the caller
 * should keep the intent-aware (generic / uncited) table.
 */
export function allocateGenericSovPie(result: GenericSovResult): GenericSovShareAllocation | null {
	if (!result.query.strictEntityCheck) return null;
	const winners = result.scores.filter((row) => row.entityMatch !== 'none');
	if (!winners.length) return null;

	const board = result.leaderboard.filter((row) => row.entityMatch !== 'none' || row.isClient);
	const client = board.find((row) => row.isClient);
	const peers = board.filter((row) => !row.isClient);
	const thirdParty = SPECIALIZED_THIRD_PARTY;
	const pool = 100 - thirdParty;
	const parts = [client, peers[0], peers[1]];
	const weights = parts.map((row) => (row && row.entityMatch !== 'none' ? row.rawScore : 0));
	const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1;
	const scaled = weights.map((weight) => (weight / weightSum) * pool);
	const rounded = roundSharesTo100([...scaled, thirdParty]);
	const clientRank = client && client.entityMatch !== 'none' ? result.clientRank : 4;

	return {
		own: rounded[0] ?? 0,
		rank1: rounded[1] ?? 0,
		rank2: rounded[2] ?? 0,
		thirdParty: rounded[3] ?? thirdParty,
		clientRank,
		usedGenericScores: true,
	};
}
