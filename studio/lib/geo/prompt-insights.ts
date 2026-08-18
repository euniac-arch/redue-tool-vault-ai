/**
 * Keyword contribution weights + 3-axis GEO recommendation reasons.
 * Bound to the currently selected site (meta / OG / specialties) — never hardcoded clinics.
 */

import { hasStrongPlasticSignal } from '@/lib/geo/core-specialties';
import { entityNoun, isMedicalSchema } from '@/lib/geo/query-coverage';
import type {
	ExpandedQueryCoverage,
	GeoSiteContext,
	KeywordWeight,
	KeywordWeightSource,
	PrescriptionLang,
	RecommendationReason,
	SchemaOrgPrimaryType,
} from '@/types/geo-prescription';

const CLUSTER_DEFS: Array<{
	id: string;
	test: RegExp;
	labelKo: string;
	labelEn: string;
	terms: string[];
}> = [
	{
		id: 'plastic',
		test: /성형외과|성형수술|성형시술|미용성형|plastic\s*surg/i,
		labelKo: '성형외과',
		labelEn: 'plastic surgery',
		terms: ['성형외과', '성형수술', '미용성형', 'plastic'],
	},
	{
		id: 'derm',
		test: /피부과|보톡스|필러|리프팅|dermatolog|skin\s*clinic/i,
		labelKo: '피부과',
		labelEn: 'dermatology',
		terms: ['피부과', '보톡스', '필러', '리프팅', 'dermat'],
	},
	{
		id: 'rehab',
		test: /스포츠\s*재활|재활|정형|도수|통증|sport|rehab|ortho|pain/i,
		labelKo: '스포츠재활',
		labelEn: 'sports rehab',
		terms: ['스포츠재활', '재활', '정형', '도수', '통증', 'sport', 'rehab', 'ortho', 'pain'],
	},
	{
		id: 'child',
		test: /아동|소아|발달|pediatric|child|develop/i,
		labelKo: '아동발달',
		labelEn: 'child development',
		terms: ['아동발달', '소아재활', '발달', 'pediatric', 'child'],
	},
	{
		id: 'dental',
		test: /치과|임플란트|치아교정|dental|implant/i,
		labelKo: '치과/임플란트',
		labelEn: 'dental / implant',
		terms: ['치과', '임플란트', '교정', 'dental', 'implant'],
	},
	{
		id: 'cancer',
		test: /암|중입자|종양|cancer|oncolog|particle|carbon/i,
		labelKo: '암치료',
		labelEn: 'cancer care',
		terms: ['암치료', '중입자', '종양', 'cancer', 'oncolog'],
	},
];

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.round(n)));
}

function countHits(haystack: string, needles: string[]): number {
	if (!haystack) return 0;
	const lower = haystack.toLowerCase();
	return needles.reduce((sum, needle) => {
		const token = needle.toLowerCase();
		if (token.length < 2) return sum;
		let hits = 0;
		let from = 0;
		while (from < lower.length) {
			const at = lower.indexOf(token, from);
			if (at < 0) break;
			hits += 1;
			from = at + token.length;
		}
		return sum + hits;
	}, 0);
}

function joinLabel(location: string, cluster: string): string {
	return location ? `${location} + ${cluster}` : cluster;
}

function schemaHintsFor(schema: SchemaOrgPrimaryType): string[] {
	const hints = [schema];
	if (
		isMedicalSchema(schema) ||
		schema === 'Restaurant' ||
		schema === 'BeautySalon' ||
		schema === 'LocalBusiness' ||
		schema === 'Store'
	) {
		hints.push('OpeningHours');
	}
	if (!hints.includes('FAQPage')) hints.push('FAQPage');
	return hints.slice(0, 3);
}

function genericQuery(ctx: GeoSiteContext, coverage: ExpandedQueryCoverage): string {
	const loc = coverage.location || ctx.location;
	const noun = entityNoun(ctx.schemaType, ctx.lang);
	if (coverage.spectrum.level2 && coverage.spectrum.level2 !== coverage.brandName) {
		return coverage.spectrum.level2;
	}
	return loc ? `${loc} ${noun}`.trim() : noun;
}

function comboExample(coverage: ExpandedQueryCoverage): string {
	return coverage.afterCombos[0]?.display || coverage.spectrum.level3 || coverage.category;
}

function detectSource(inOg: boolean, inMeta: boolean, inSchema: boolean): KeywordWeightSource {
	if (inOg) return 'og';
	if (inMeta) return 'meta';
	if (inSchema) return 'schema';
	return 'keyword';
}

function compactSpecialty(raw: string, loc: string): string {
	const trimmed = raw.replace(/\s+/g, ' ').trim();
	if (!loc) return trimmed;
	return trimmed.replace(new RegExp(`^${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '').trim() || trimmed;
}

/**
 * Relative AI recognition weights from og:description / meta / schema specialties.
 * Scores are independent recognition strengths (not required to sum to 100).
 */
export function buildKeywordWeights(ctx: GeoSiteContext, coverage: ExpandedQueryCoverage): KeywordWeight[] {
	const lang = ctx.lang;
	const loc = coverage.location || ctx.location;
	const og = `${ctx.ogDescription || ''}`;
	const meta = `${ctx.description || ''} ${ctx.ogTitle || ''}`;
	const schemaCorpus = [ctx.schemaType, ...ctx.existingSchemaTypes, ...ctx.specialties].join(' ');
	const onPage = `${og} ${meta} ${ctx.ogTitle || ''}`;
	const plasticOk = hasStrongPlasticSignal(onPage);
	const weightedCorpus = [og, og, og, meta, meta, schemaCorpus, coverage.category, ctx.primaryKeyword, ...ctx.targetKeywords].join(
		' · ',
	);

	const used = new Set<string>();
	const rows: KeywordWeight[] = [];

	for (const cluster of CLUSTER_DEFS) {
		if (cluster.id === 'plastic' && !plasticOk) continue;
		const hay = `${weightedCorpus} ${coverage.specialties.join(' ')} ${coverage.category}`;
		if (!cluster.test.test(hay)) continue;
		const label = joinLabel(loc, lang === 'en' ? cluster.labelEn : cluster.labelKo);
		if (used.has(label.toLowerCase())) continue;
		used.add(label.toLowerCase());
		const ogHits = countHits(og, cluster.terms);
		const metaHits = countHits(meta, cluster.terms);
		const schemaHits = countHits(schemaCorpus, cluster.terms);
		const allHits = countHits(weightedCorpus, cluster.terms);
		const primaryBoost = cluster.test.test(`${ctx.primaryKeyword} ${coverage.category}`) ? 14 : 0;
		const weight = clamp(48 + allHits * 7 + ogHits * 8 + metaHits * 4 + schemaHits * 5 + primaryBoost, 42, 92);
		rows.push({
			id: cluster.id,
			label,
			tokens: [loc, lang === 'en' ? cluster.labelEn : cluster.labelKo].filter(Boolean),
			weight,
			source: detectSource(ogHits > 0, metaHits > 0, schemaHits > 0),
		});
	}

	for (const spec of coverage.specialties.slice(0, 4)) {
		const compact = compactSpecialty(spec, loc);
		if (!compact || compact.length < 2) continue;
		const label = joinLabel(loc, compact);
		if (used.has(label.toLowerCase())) continue;
		if (CLUSTER_DEFS.some((c) => c.test.test(compact) && used.has(joinLabel(loc, lang === 'en' ? c.labelEn : c.labelKo).toLowerCase()))) {
			continue;
		}
		used.add(label.toLowerCase());
		const terms = compact.split(/[\s+/]/).filter((t) => t.length >= 2);
		const ogHits = countHits(og, terms);
		const metaHits = countHits(meta, terms);
		const allHits = countHits(weightedCorpus, terms);
		rows.push({
			id: `spec-${rows.length}`,
			label,
			tokens: [loc, compact].filter(Boolean),
			weight: clamp(50 + allHits * 6 + ogHits * 10 + metaHits * 4, 44, 88),
			source: detectSource(ogHits > 0, metaHits > 0, false),
		});
	}

	if (!rows.length) {
		const category = compactSpecialty(coverage.category || ctx.primaryKeyword, loc);
		rows.push({
			id: 'primary',
			label: joinLabel(loc, category),
			tokens: [loc, category].filter(Boolean),
			weight: og.trim() ? 72 : 58,
			source: og.trim() ? 'og' : ctx.description ? 'meta' : 'keyword',
		});
	}

	return rows.sort((a, b) => b.weight - a.weight).slice(0, 4);
}

export function buildRecommendationReasons(
	ctx: GeoSiteContext,
	coverage: ExpandedQueryCoverage,
): RecommendationReason[] {
	const lang = ctx.lang;
	const en = lang === 'en';
	const example = comboExample(coverage);
	const hints = schemaHintsFor(ctx.schemaType);
	const hintList = hints.join(', ');
	const contrast = genericQuery(ctx, coverage);
	const faqHint = en ? 'structured FAQ and short Q&A sentences' : '구조화된 FAQ와 단문 Q&A';
	const loc = coverage.location || ctx.location || (en ? 'this area' : '해당 지역');

	const entity: RecommendationReason = {
		id: 'entity_specificity',
		index: 1,
		title: en ? 'Entity specificity' : '엔티티 정밀 결합',
		subtitle: 'Entity Specificity',
		example,
		schemaHints: hints,
		mechanism: en
			? `The more specific the combo (“${example}”), the closer it maps 1:1 onto schema markup (${hintList}), which maximizes the model’s recommendation confidence.`
			: `“${example}”처럼 단어가 구체적일수록 스키마 마크업(${hintList})과 1:1로 일치하여 AI의 추천 확신도가 극대화됩니다.`,
	};

	const rag: RecommendationReason = {
		id: 'rag_citation',
		index: 2,
		title: en ? 'AI citation readiness' : 'AI 인용 용이성',
		subtitle: 'RAG Citation Readiness',
		example,
		schemaHints: ['FAQPage'],
		mechanism: en
			? `${faqHint} are patched so crawlers can lift those sentences first when generating an answer about “${example}”.`
			: `${faqHint} 텍스트가 패치되어 AI 크롤러가 “${example}” 답변 생성 시 해당 문장을 1순위로 인용(Citation)하기 쉬워집니다.`,
	};

	const longtail: RecommendationReason = {
		id: 'longtail_intent',
		index: 3,
		title: en ? 'Long-tail intent dominance' : '세부 의도 독점',
		subtitle: 'Long-tail Intent Dominance',
		example,
		contrastQuery: contrast,
		schemaHints: hints.slice(0, 1),
		mechanism: en
			? `A simple query like “${contrast}” is crowded. Conversational combos such as “${example}” in ${loc} are far more likely to monopolize the AI recommendation list versus competing sites.`
			: `단순 단어(“${contrast}”) 대비, “${example}” 같은 대화형 세부 조합 질문은 경쟁 사이트 대비 AI 추천 목록을 독점할 확률이 대폭 증가합니다.`,
	};

	return [entity, rag, longtail];
}

export function isKeywordWeights(raw: unknown): raw is KeywordWeight[] {
	if (!Array.isArray(raw) || raw.length === 0) return false;
	return raw.every(
		(row) =>
			row &&
			typeof row === 'object' &&
			typeof (row as KeywordWeight).label === 'string' &&
			typeof (row as KeywordWeight).weight === 'number',
	);
}

export function isRecommendationReasons(raw: unknown): raw is RecommendationReason[] {
	if (!Array.isArray(raw) || raw.length < 3) return false;
	return raw.every(
		(row) =>
			row &&
			typeof row === 'object' &&
			typeof (row as RecommendationReason).id === 'string' &&
			typeof (row as RecommendationReason).mechanism === 'string',
	);
}
