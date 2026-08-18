/**
 * GEO comprehensive score engine — 4 pillars × 25 = 100.
 *
 * The headline 외부 신뢰도 · GEO score is the exact sum of the four
 * measured pillars. Each pillar's sub-items add up to 25. Bottom Tab-1
 * cards bind the same `GeoPillarScore` objects 1:1 via `targetAnchorId`.
 */

import { computeAdvancedGeoFromReport } from '@/lib/audit/advancedGeoFromReport';
import { computeEntityDisambiguation } from '@/lib/audit/advancedGeoMetrics';
import {
	computeGoogleMentionCount,
	computeNapMatchRate,
	computeNaverPostingsCount,
	googleMentionBenchmarkFor,
	resolveEeatVertical,
} from '@/lib/audit/eeat-audit';
import { detectEnginePlatformSignals, type EnginePlatformSignals } from '@/lib/audit/engine-analysis';
import { resolveAiBotsAllowed } from '@/lib/audit/robots-ai-bots';
import { HTTPS_GEO_PENALTY, HTTPS_GRADE_HARD_CAP, resolveIsHttps } from '@/lib/audit/scoreCalculator';
import type { AuditCheckItem, AuditLang, AuditReport } from '@/lib/site-auditor';

export const GEO_PILLAR_MAX = 25 as const;
export const GEO_TOTAL_MAX = 100 as const;

export const GEO_PILLAR_IDS = ['entity', 'bot_index', 'local_nap', 'rag_authority'] as const;
export type GeoPillarId = (typeof GEO_PILLAR_IDS)[number];

export const GEO_PILLAR_ANCHOR_IDS = {
	entity: 'geo-section-entity',
	bot_index: 'geo-section-bot',
	local_nap: 'geo-section-nap',
	rag_authority: 'geo-section-authority',
} as const satisfies Record<GeoPillarId, string>;

export interface GeoRawSignals {
	hasKnowledgeGraph?: boolean;
	taxId?: string | null;
	/** Google/Naver Place CID — missing this is 0/25 on the entity gauge. */
	placeCid?: string | null;
	sameAsCount?: number;
	/** Representative Person knowledge-graph link — missing this is 0/20 on the entity gauge. */
	hasPersonKg?: boolean;
	brandDisambiguated?: boolean;
	allowAiBots?: boolean;
	hasLlmsTxt?: boolean;
	hasSearchIndex?: boolean;
	hasNaverPlace?: boolean;
	napMatchRate?: number;
	hasGoogleMap?: boolean;
	hasBingPlaces?: boolean;
	bodyLength?: number;
	hasEeatDocs?: boolean;
	/** Combined web-mention documents (Google + Naver). Kept for evidence totals. */
	mentionCount?: number;
	/** Google-only mention volume used for Brand Mention scoring. */
	googleMentionCount?: number;
	/** Industry regional average. Below this is 5/7 (caution), not 7/7. */
	googleMentionBenchmark?: number;
	naverMentionCount?: number;
}

export interface GeoSubItem {
	id: string;
	name: string;
	score: number;
	maxScore: number;
	passed: boolean;
	evidence?: string;
}

export interface GeoPillarScore {
	id: GeoPillarId;
	name: string;
	shortName: string;
	icon: string;
	earned: number;
	max: typeof GEO_PILLAR_MAX;
	percentage: number;
	description: string;
	targetAnchorId: string;
	items: GeoSubItem[];
}

export interface ComprehensiveGeoResult {
	/** 100-point measured total (sum of 4 pillars). */
	rawGeoScore: number;
	/** Security deduction + B-grade cap when HTTPS is missing. */
	finalGeoScore: number;
	isCapped: boolean;
	pillars: Record<GeoPillarId, GeoPillarScore>;
	pillarList: GeoPillarScore[];
}

const PILLAR_COPY: Record<
	GeoPillarId,
	{ name: { ko: string; en: string }; shortName: { ko: string; en: string }; icon: string; description: { ko: string; en: string } }
> = {
	entity: {
		name: { ko: '엔티티 & 지식그래프', en: 'Entity & Knowledge Graph' },
		shortName: { ko: '엔티티', en: 'Entity' },
		icon: '🏛️',
		description: { ko: '지식그래프 및 sameAs 연결성', en: 'Knowledge graph and sameAs connectivity' },
	},
	bot_index: {
		name: { ko: 'AI 봇 & 검색 인덱스', en: 'AI Bots & Search Index' },
		shortName: { ko: 'AI 봇 수집', en: 'AI bots' },
		icon: '🤖',
		description: { ko: 'AI 크롤러 허용 및 /llms.txt', en: 'AI crawler allow-list and /llms.txt' },
	},
	local_nap: {
		name: { ko: '로컬 플랫폼 & NAP 일관성', en: 'Local Platforms & NAP Consistency' },
		shortName: { ko: '로컬 NAP', en: 'Local NAP' },
		icon: '📍',
		description: { ko: '네이버/구글/Bing 지도 및 정보 일치', en: 'Naver / Google / Bing maps and NAP match' },
	},
	rag_authority: {
		name: { ko: '디지털 풋프린트 & RAG 충실도', en: 'Digital Footprint & RAG Fidelity' },
		shortName: { ko: '디지털 풋프린트', en: 'Digital footprint' },
		icon: '📚',
		description: { ko: '수치화된 팩트 밀도 및 외부 언급량', en: 'Fact density and external brand mentions' },
	},
};

function loc(lang: AuditLang, pair: { ko: string; en: string }): string {
	return lang === 'en' ? pair.en : pair.ko;
}

function clampInt(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, Math.round(value)));
}

export type GeoPillarStatus = 'ok' | 'warn' | 'urgent';

/** Header-badge copy is more granular than the 3-tone bar status. */
export type GeoPillarBadgeCopy = 'ok' | 'recommend' | 'warn' | 'needs_work' | 'urgent';
export type GeoPillarBadgeTheme = 'rose' | 'amber' | 'emerald';

/** Badge/status must follow failed sub-items, not just the 25-point percentage. */
export function resolveGeoPillarStatus(pillar: Pick<GeoPillarScore, 'percentage' | 'items'>): GeoPillarStatus {
	const allPassed = pillar.items.every((item) => item.passed);
	if (allPassed && pillar.percentage >= 80) return 'ok';
	if (pillar.percentage < 50) return 'urgent';
	return 'warn';
}

/**
 * Flat header-badge label:
 *   ≥80% all passed → 양호
 *   ≥80% with a miss → 보완 권장
 *   ≥60% → 주의
 *   ≥45% → 보완 필요
 *   else → 보완 시급
 */
export function resolveGeoPillarBadgeCopy(
	pillar: Pick<GeoPillarScore, 'percentage' | 'items'>,
): GeoPillarBadgeCopy {
	const allPassed = pillar.items.length === 0 || pillar.items.every((item) => item.passed);
	if (allPassed && pillar.percentage >= 80) return 'ok';
	if (pillar.percentage >= 80) return 'recommend';
	if (pillar.percentage >= 60) return 'warn';
	if (pillar.percentage >= 45) return 'needs_work';
	return 'urgent';
}

export function resolveGeoPillarBadgeTheme(copy: GeoPillarBadgeCopy): GeoPillarBadgeTheme {
	if (copy === 'ok') return 'emerald';
	if (copy === 'urgent') return 'rose';
	return 'amber';
}

export function geoPillarIndex(id: GeoPillarId): 1 | 2 | 3 | 4 {
	return (GEO_PILLAR_IDS.indexOf(id) + 1) as 1 | 2 | 3 | 4;
}

/**
 * Brand-mention sub-score (max 7).
 * Below the regional Google average is 5/7 (caution) — never a perfect 7
 * just because combined document volume cleared an arbitrary 100-doc floor.
 */
export function scoreBrandMentionVolume(
	googleMentionCount: number,
	googleMentionBenchmark = 0,
): { score: number; maxScore: 7; passed: boolean } {
	const count = Math.max(0, Number(googleMentionCount) || 0);
	const benchmark = Math.max(0, Number(googleMentionBenchmark) || 0);
	if (benchmark > 0) {
		if (count >= benchmark) return { score: 7, maxScore: 7, passed: true };
		if (count > 0) return { score: 5, maxScore: 7, passed: false };
		return { score: 4, maxScore: 7, passed: false };
	}
	if (count >= 100) return { score: 7, maxScore: 7, passed: true };
	return { score: 4, maxScore: 7, passed: false };
}

function presentText(value: string | null | undefined): string {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * Axis 1 (25): map the 4 measured entity factors (taxID 30 + CID 25 + sameAs 25 + person KG 20)
 * onto the 3 sub-items (10 + 8 + 7). taxID-only + SNS×2 + no CID/KG → 5+3+4 = 12 (48%).
 */
export function scoreEntityAxisItems(
	rawData: Pick<GeoRawSignals, 'taxId' | 'placeCid' | 'sameAsCount' | 'hasPersonKg'>,
	lang: AuditLang = 'ko',
): GeoSubItem[] {
	const taxId = presentText(rawData.taxId);
	const placeCid = presentText(rawData.placeCid);
	const hasTaxId = Boolean(taxId);
	const hasPlaceCid = Boolean(placeCid);
	const sameAsCount = Math.max(0, Number(rawData.sameAsCount) || 0);
	const hasPersonKg = Boolean(rawData.hasPersonKg);

	let entityIdScore = 0;
	if (hasTaxId && hasPlaceCid) entityIdScore = 10;
	else if (hasTaxId) entityIdScore = 5;
	else entityIdScore = 2;

	let sameAsScore = 0;
	if (sameAsCount >= 2 && hasPersonKg) sameAsScore = 8;
	else if (sameAsCount >= 2) sameAsScore = 3;
	else sameAsScore = 1;

	const disambiguationScore = hasPlaceCid ? 7 : 4;

	return [
		{
			id: 'entity_kg',
			name: loc(lang, {
				ko: '공식 엔티티 · 사업자/플레이스 식별',
				en: 'Official entity · business/place identity',
			}),
			score: entityIdScore,
			maxScore: 10,
			passed: hasTaxId && hasPlaceCid,
			evidence: hasTaxId && hasPlaceCid
				? loc(lang, { ko: '사업자 및 플레이스 CID 완비', en: 'Business registration and Place CID complete' })
				: hasTaxId
					? loc(lang, {
							ko: `사업자 확인(${taxId}) · 플레이스 CID 미검출`,
							en: `Business registration confirmed (${taxId}) · Place CID not detected`,
						})
					: loc(lang, { ko: '엔티티 식별 미흡', en: 'Entity identity is incomplete' }),
		},
		{
			id: 'same_as_channels',
			name: loc(lang, {
				ko: 'sameAs 공식 채널 · 대표자 지식그래프',
				en: 'sameAs channels · representative knowledge graph',
			}),
			score: sameAsScore,
			maxScore: 8,
			passed: sameAsCount >= 2 && hasPersonKg,
			evidence: hasPersonKg && sameAsCount >= 2
				? loc(lang, {
						ko: 'SNS 채널 및 대표자 지식그래프 완비',
						en: 'SNS channels and representative knowledge graph complete',
					})
				: sameAsCount >= 2
					? loc(lang, {
							ko: `SNS ${sameAsCount}개 매핑 · 대표자 지식그래프 미연동`,
							en: `${sameAsCount} SNS channel(s) mapped · representative knowledge graph unlinked`,
						})
					: loc(lang, {
							ko: `${sameAsCount}개 공식 채널 연결`,
							en: `${sameAsCount} official channel(s) linked`,
						}),
		},
		{
			id: 'domain_disambiguation',
			name: loc(lang, { ko: '브랜드명 고유성 · 도메인 정합도', en: 'Brand uniqueness · domain match' }),
			score: disambiguationScore,
			maxScore: 7,
			passed: true,
			evidence: hasPlaceCid
				? loc(lang, { ko: '도메인 및 상호명 매칭 완료', en: 'Domain and brand name match' })
				: loc(lang, {
						ko: '도메인 매칭 완료 (플레이스 식별 보완 권장)',
						en: 'Domain matched (Place identity still recommended)',
					}),
		},
	];
}

function buildPillar(
	id: GeoPillarId,
	lang: AuditLang,
	items: GeoSubItem[],
): GeoPillarScore {
	const copy = PILLAR_COPY[id];
	const earned = Math.min(GEO_PILLAR_MAX, items.reduce((acc, cur) => acc + cur.score, 0));
	return {
		id,
		name: loc(lang, copy.name),
		shortName: loc(lang, copy.shortName),
		icon: copy.icon,
		earned,
		max: GEO_PILLAR_MAX,
		percentage: Math.round((earned / GEO_PILLAR_MAX) * 100),
		description: loc(lang, copy.description),
		targetAnchorId: GEO_PILLAR_ANCHOR_IDS[id],
		items,
	};
}

export function calculateGeoComprehensiveScores(
	rawData: GeoRawSignals,
	isHttps: boolean,
	lang: AuditLang = 'ko',
): ComprehensiveGeoResult {
	const napMatchRate = Number.isFinite(rawData.napMatchRate) ? Number(rawData.napMatchRate) : 0;
	const bodyLength = Math.max(0, Number(rawData.bodyLength) || 0);
	const mentionCount = Math.max(0, Number(rawData.mentionCount) || 0);
	const googleMentionCount = Math.max(
		0,
		Number(rawData.googleMentionCount ?? rawData.mentionCount) || 0,
	);
	const googleMentionBenchmark = Math.max(0, Number(rawData.googleMentionBenchmark) || 0);
	const brandMention = scoreBrandMentionVolume(googleMentionCount, googleMentionBenchmark);
	const allowAiBots = rawData.allowAiBots !== false;
	const hasLlmsTxt = Boolean(rawData.hasLlmsTxt);
	const hasSearchIndex = Boolean(rawData.hasSearchIndex);
	const hasNaverPlace = Boolean(rawData.hasNaverPlace);
	const hasGoogleMap = Boolean(rawData.hasGoogleMap);
	const hasBingPlaces = Boolean(rawData.hasBingPlaces);
	const hasEeatDocs = Boolean(rawData.hasEeatDocs);

	const entityItems = scoreEntityAxisItems(rawData, lang);

	const botItems: GeoSubItem[] = [
		{
			id: 'ai_bot_allow',
			name: loc(lang, { ko: 'GPTBot / ClaudeBot / PerplexityBot / Google-Extended · 크롤러 허용', en: 'GPTBot / ClaudeBot / PerplexityBot / Google-Extended · crawler allow' }),
			score: allowAiBots ? 10 : 0,
			maxScore: 10,
			passed: allowAiBots,
			evidence: allowAiBots
				? loc(lang, { ko: 'AI 크롤러 전체 허용', en: 'AI crawlers are allowed' })
				: loc(lang, { ko: 'robots.txt 차단 감지', en: 'robots.txt block detected' }),
		},
		{
			id: 'llms_txt_presence',
			name: loc(lang, { ko: '/llms.txt · AI 전용 인덱스 구비', en: '/llms.txt · AI index file present' }),
			score: hasLlmsTxt ? 8 : 0,
			maxScore: 8,
			passed: hasLlmsTxt,
			evidence: hasLlmsTxt
				? loc(lang, { ko: '루트 파일 배포 확인', en: 'Root file confirmed' })
				: loc(lang, { ko: 'GET /llms.txt 404 (미구비)', en: 'GET /llms.txt 404 (missing)' }),
		},
		{
			id: 'search_index_signals',
			name: loc(lang, { ko: 'Google·Bing·Naver · 색인 안정성', en: 'Google, Bing & Naver · index stability' }),
			score: hasSearchIndex ? 7 : 5,
			maxScore: 7,
			passed: true,
			evidence: hasSearchIndex
				? loc(lang, { ko: '주요 검색 포털 인덱스 신호 수신', en: 'Major search-index signals received' })
				: loc(lang, { ko: '색인 허용 신호 부분 확인', en: 'Partial index-allow signals' }),
		},
	];

	const localItems: GeoSubItem[] = [
		{
			id: 'naver_place_nap',
			name: loc(lang, { ko: '네이버 플레이스 · NAP 일치도', en: 'Naver Place link · NAP match' }),
			score: hasNaverPlace ? 10 : napMatchRate >= 80 ? 7 : 4,
			maxScore: 10,
			passed: Boolean(hasNaverPlace || napMatchRate >= 80),
			evidence: loc(lang, { ko: `NAP 일치율: ${napMatchRate}%`, en: `NAP match rate: ${napMatchRate}%` }),
		},
		{
			id: 'google_map_profile',
			name: loc(lang, { ko: '구글 비즈니스 프로필 · 지도 연동', en: 'Google Business Profile · Maps signal' }),
			score: hasGoogleMap ? 8 : 4,
			maxScore: 8,
			passed: hasGoogleMap,
			evidence: hasGoogleMap
				? loc(lang, { ko: 'Google Maps 연동', en: 'Google Maps linked' })
				: loc(lang, { ko: '구글 지도 신호 부족', en: 'Google Maps signal is weak' }),
		},
		{
			id: 'bing_places_signal',
			name: loc(lang, { ko: 'Bing Places 등록 · 좌표 일치도', en: 'Bing Places listing · coordinate match' }),
			score: hasBingPlaces ? 7 : 0,
			maxScore: 7,
			passed: hasBingPlaces,
			evidence: hasBingPlaces
				? loc(lang, { ko: 'Bing Places 연동', en: 'Bing Places linked' })
				: loc(lang, { ko: 'Bing Places 미등록', en: 'Bing Places not registered' }),
		},
	];

	const authorityItems: GeoSubItem[] = [
		{
			id: 'rag_fact_density',
			name: loc(lang, { ko: 'AI 추출용 수치·통계 · 팩트 밀도', en: 'Numeric/statistical · fact density' }),
			score: bodyLength >= 1000 ? 10 : 5,
			maxScore: 10,
			passed: bodyLength >= 1000,
			evidence: loc(lang, { ko: `본문 ${bodyLength}자 분석`, en: `Analyzed ${bodyLength} body characters` }),
		},
		{
			id: 'eeat_references',
			name: loc(lang, { ko: '공인 인증·학술·특허 · 3자 레퍼런스', en: 'Third-party credentials · academic & patent refs' }),
			score: hasEeatDocs ? 8 : 4,
			maxScore: 8,
			passed: hasEeatDocs,
			evidence: hasEeatDocs
				? loc(lang, { ko: 'E-E-A-T 인증 레퍼런스 구비', en: 'E-E-A-T credential references present' })
				: loc(lang, { ko: '3자 공인 문서 보강 필요', en: 'Third-party credential documents need work' }),
		},
		{
			id: 'digital_mentions',
			name: loc(lang, { ko: '외부 웹 · 브랜드 언급량', en: 'External web · brand-mention volume' }),
			score: brandMention.score,
			maxScore: brandMention.maxScore,
			passed: brandMention.passed,
			evidence:
				googleMentionBenchmark > 0
					? loc(lang, {
							ko: brandMention.passed
								? `구글 ${googleMentionCount}건 / 지역 평균 ${googleMentionBenchmark}건`
								: `구글 ${googleMentionCount}건 < 지역 평균 ${googleMentionBenchmark}건`,
							en: brandMention.passed
								? `Google ${googleMentionCount} / regional avg ${googleMentionBenchmark}`
								: `Google ${googleMentionCount} < regional avg ${googleMentionBenchmark}`,
						})
					: loc(lang, { ko: `웹 언급 문서 ${mentionCount || googleMentionCount}건`, en: `${mentionCount || googleMentionCount} web mention document(s)` }),
		},
	];

	const pillars = {
		entity: buildPillar('entity', lang, entityItems),
		bot_index: buildPillar('bot_index', lang, botItems),
		local_nap: buildPillar('local_nap', lang, localItems),
		rag_authority: buildPillar('rag_authority', lang, authorityItems),
	} satisfies Record<GeoPillarId, GeoPillarScore>;

	const pillarList = GEO_PILLAR_IDS.map((id) => pillars[id]);
	const rawGeoScore = clampInt(
		pillarList.reduce((sum, pillar) => sum + pillar.earned, 0),
		0,
		GEO_TOTAL_MAX,
	);

	let finalGeoScore = rawGeoScore;
	let isCapped = false;
	if (!isHttps) {
		finalGeoScore = Math.min(HTTPS_GRADE_HARD_CAP, Math.max(0, rawGeoScore - HTTPS_GEO_PENALTY));
		isCapped = true;
	}

	return {
		rawGeoScore,
		finalGeoScore,
		isCapped,
		pillars,
		pillarList,
	};
}

export interface GeoReputationSignalSlice {
	orgPresent?: boolean;
	orgComplete?: boolean;
	faqPresent?: boolean;
	aiBotsOk?: boolean;
	aiBotAccess?: Partial<Record<'gptbot' | 'perplexitybot' | 'claudebot' | 'google-extended', boolean>>;
	schemaPct?: number;
	geoPct?: number;
	schemaTypes?: readonly string[];
	jsonLdCorpus?: string;
	platform?: EnginePlatformSignals;
	isHttps?: boolean;
	industryType?: string;
	category?: string;
	hasLlmsTxt?: boolean;
	bodyLength?: number;
	hasSearchIndex?: boolean;
	eeatOk?: boolean;
}

/** Map already-normalized reputation signals onto the 4-pillar raw inputs. */
export function geoRawSignalsFromReputation(signals: GeoReputationSignalSlice): GeoRawSignals {
	const platform =
		signals.platform ??
		detectEnginePlatformSignals({
			schemaTypes: signals.schemaTypes,
			jsonLdCorpus: signals.jsonLdCorpus,
		});
	const allowAiBots = resolveAiBotsAllowed(signals.aiBotAccess, signals.aiBotsOk);
	const vertical = resolveEeatVertical({
		industryType: signals.industryType,
		keywordHay: signals.category,
	});
	const napMatchRate = computeNapMatchRate({
		orgPresent: Boolean(signals.orgPresent),
		orgComplete: Boolean(signals.orgComplete),
		hasTelephone: platform.hasTelephone,
		hasAddress: platform.hasAddress,
		hasOpeningHours: platform.hasOpeningHours,
	});
	const googleMentionCount = computeGoogleMentionCount({
		schemaPct: signals.schemaPct ?? 50,
		orgPresent: Boolean(signals.orgPresent),
		orgComplete: Boolean(signals.orgComplete),
		sameAsCount: platform.sameAsCount,
		googleMapsLinked: platform.googleMapsLinked,
		vertical,
	});
	const naverMentionCount = computeNaverPostingsCount({
		naverPlaceLinked: platform.naverPlaceLinked,
		naverBlogLinked: platform.naverBlogLinked,
		geoPct: signals.geoPct ?? 50,
		vertical,
	});
	const entity = computeEntityDisambiguation({
		jsonLdCorpus: signals.jsonLdCorpus,
		sameAs: platform.sameAsCount,
	});

	return {
		hasKnowledgeGraph: Boolean(signals.orgPresent || signals.orgComplete || platform.hasOrganization),
		taxId: entity.breakdown.taxId.valid ? entity.breakdown.taxId.value : undefined,
		placeCid: entity.breakdown.placeCid.present ? entity.breakdown.placeCid.value : undefined,
		sameAsCount: Math.max(platform.sameAsCount, entity.breakdown.sameAs.count),
		hasPersonKg: entity.breakdown.representativeKg.linked,
		brandDisambiguated: entity.breakdown.placeCid.present,
		allowAiBots,
		hasLlmsTxt: Boolean(signals.hasLlmsTxt),
		hasSearchIndex: signals.hasSearchIndex !== false,
		hasNaverPlace: platform.naverPlaceLinked,
		napMatchRate,
		hasGoogleMap: platform.googleMapsLinked,
		hasBingPlaces: platform.bingPlacesLinked,
		bodyLength: Math.max(0, Number(signals.bodyLength) || 0),
		hasEeatDocs: Boolean(signals.faqPresent || signals.eeatOk || platform.officialDocCount > 0),
		mentionCount: googleMentionCount + naverMentionCount,
		googleMentionCount,
		googleMentionBenchmark: googleMentionBenchmarkFor(vertical),
		naverMentionCount,
	};
}

function checkStatus(check: AuditCheckItem): 'pass' | 'fail' | 'warning' {
	return check.status ?? (check.passed ? 'pass' : 'fail');
}

function checkPassed(checks: AuditCheckItem[], id: string): boolean {
	const found = checks.find((item) => item.id === id);
	return found ? checkStatus(found) === 'pass' : false;
}

/** Precise path — bind crawl evidence from a full `AuditReport`. */
export function extractGeoRawSignalsFromReport(report: AuditReport): GeoRawSignals {
	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((category) => category.checks);
	const jsonLdCorpus = (report.metrics?.jsonLdSnippets ?? []).join('\n');
	const extraCorpus = [...(report.collectedUrls ?? []), report.footerText ?? ''].join('\n');
	const platform = detectEnginePlatformSignals({
		schemaTypes: report.metrics?.schemaTypes ?? report.siteMeta?.schemaEntityTypes,
		jsonLdCorpus,
		extraCorpus,
	});
	const advanced = computeAdvancedGeoFromReport(report);
	const entity = advanced.entityDisambiguation;
	const orgMissing = report.metrics?.organizationMissing;
	const orgPresent =
		checkPassed(checks, 'organization') ||
		checks.some((item) => item.id === 'organization' && checkStatus(item) === 'warning') ||
		platform.hasOrganization;
	const orgComplete = orgPresent && (!orgMissing || orgMissing.length === 0);
	const botsCheckOk = checkPassed(checks, 'ai-bots-allowed');
	const allowAiBots = resolveAiBotsAllowed(report.metrics?.aiBotAccess, botsCheckOk);
	const vertical = resolveEeatVertical({
		industryType: report.siteMeta?.industryType,
		keywordHay: report.siteMeta?.category,
	});
	const napMatchRate = computeNapMatchRate({
		orgPresent,
		orgComplete,
		hasTelephone: platform.hasTelephone,
		hasAddress: platform.hasAddress,
		hasOpeningHours: platform.hasOpeningHours,
	});
	const googleMentionCount = computeGoogleMentionCount({
		schemaPct: report.schemaCoverage ?? 50,
		orgPresent,
		orgComplete,
		sameAsCount: platform.sameAsCount || entity.breakdown.sameAs.count,
		googleMapsLinked: platform.googleMapsLinked,
		vertical,
	});
	const naverMentionCount = computeNaverPostingsCount({
		naverPlaceLinked: platform.naverPlaceLinked,
		naverBlogLinked: platform.naverBlogLinked,
		geoPct: report.geoCitationScore ?? 50,
		vertical,
	});

	return {
		hasKnowledgeGraph: Boolean(
			entity.breakdown.representativeKg.linked || orgPresent || platform.hasOrganization || entity.breakdown.taxId.valid,
		),
		taxId: entity.breakdown.taxId.valid ? entity.breakdown.taxId.value : undefined,
		placeCid: entity.breakdown.placeCid.present ? entity.breakdown.placeCid.value : undefined,
		sameAsCount: Math.max(platform.sameAsCount, entity.breakdown.sameAs.count),
		hasPersonKg: entity.breakdown.representativeKg.linked,
		brandDisambiguated: entity.breakdown.placeCid.present,
		allowAiBots,
		hasLlmsTxt: advanced.hasLlmsTxt || checkPassed(checks, 'llms-txt') || checkPassed(checks, 'llms_txt'),
		hasSearchIndex: report.indexStatus ? report.indexStatus.allowed : true,
		hasNaverPlace: platform.naverPlaceLinked,
		napMatchRate,
		hasGoogleMap: platform.googleMapsLinked,
		hasBingPlaces: platform.bingPlacesLinked,
		bodyLength: report.metrics?.bodyTextLength ?? 0,
		hasEeatDocs: Boolean(
			platform.officialDocCount > 0 ||
				checkPassed(checks, 'person-eeat') ||
				checkPassed(checks, 'eeat-author') ||
				checkPassed(checks, 'faq-howto-schema'),
		),
		mentionCount: googleMentionCount + naverMentionCount,
		googleMentionCount,
		googleMentionBenchmark: googleMentionBenchmarkFor(vertical),
		naverMentionCount,
	};
}

export function calculateGeoComprehensiveFromReport(
	report: AuditReport,
	isHttps = resolveIsHttps({ url: report.url, hasSsl: report.hasSsl }),
	lang: AuditLang = report.lang === 'en' ? 'en' : 'ko',
): ComprehensiveGeoResult {
	return calculateGeoComprehensiveScores(extractGeoRawSignalsFromReport(report), isHttps, lang);
}

export function emptyGeoComprehensiveResult(lang: AuditLang = 'ko'): ComprehensiveGeoResult {
	return calculateGeoComprehensiveScores(
		{
			brandDisambiguated: false,
			allowAiBots: false,
			hasSearchIndex: false,
		},
		true,
		lang,
	);
}
