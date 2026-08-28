import { attachPostposition, attachQuotedPostposition, withJosa } from '@/lib/korean-josa';
import { getIndustryProfile, type IndustryType } from '@/lib/registry/universalIndustryRegistry';
import { measureAxisCoverage } from '@/lib/strategy/axis-coverage';
import { buildExecutionBlueprint, confirmedInternalUrls } from '@/lib/strategy/execution-blueprint';
import { buildSearchStrategyMap } from '@/lib/strategy/strategy-map';
import {
	detectIntentsFromNormalized,
	focusPhrase,
	hasDistrictLocation,
	locationLabel,
	matchIndustry,
	normalizeKeyword,
} from '@/lib/strategy/normalize-keyword';
import type {
	EntityCoverage,
	SearchIntentId,
	StrategyAuditContext,
	StrategyAxisCompare,
	StrategyEntityNode,
	StrategyExecutionSample,
	StrategyGap,
	StrategyIndustryProfileRef,
	StrategyLang,
	StrategyMove,
	StrategyPriorityItem,
	StrategyPriorityLevel,
	StrategyProfileSignal,
	StrategyResult,
	StrategySearchSurface,
} from '@/lib/strategy/types';

const COMMON_SIGNALS = [
	{ id: 'expertise', ko: 'Expertise', en: 'Expertise' },
	{ id: 'entity', ko: 'Entity', en: 'Entity' },
	{ id: 'local', ko: 'Local', en: 'Local' },
	{ id: 'content', ko: 'Content', en: 'Content' },
	{ id: 'trust', ko: 'Trust', en: 'Trust' },
	{ id: 'aeo', ko: 'AEO', en: 'AEO' },
] as const;

/** Profile weights — data, not engine branches. */
const EMPHASIS: Record<IndustryType, readonly string[]> = {
	medical: ['expertise', 'entity', 'local', 'content', 'trust', 'aeo'],
	veterinary: ['expertise', 'entity', 'local', 'content', 'trust', 'aeo'],
	legal: ['expertise', 'entity', 'trust', 'aeo', 'content'],
	accounting: ['expertise', 'entity', 'trust', 'aeo', 'content'],
	beauty: ['local', 'entity', 'content', 'trust', 'aeo'],
	interior: ['local', 'content', 'entity', 'trust'],
	fitness: ['local', 'entity', 'content', 'trust'],
	education: ['expertise', 'entity', 'local', 'content', 'trust'],
	realestate: ['local', 'entity', 'trust', 'content'],
	restaurant: ['local', 'content', 'trust', 'entity'],
	professional: ['expertise', 'entity', 'trust', 'content', 'aeo'],
	general: ['entity', 'local', 'content', 'trust', 'aeo'],
};

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function squeeze(value: string): string {
	return value.replace(/\s+/g, '').toLowerCase();
}

function unique(values: readonly (string | null | undefined)[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const phrase = compact(raw);
		if (!phrase) continue;
		const key = phrase.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(phrase);
	}
	return out;
}

function hasFaqSchema(ctx: StrategyAuditContext): boolean {
	return ctx.schema.types.some((type) => /faq/i.test(type));
}

function servicesOf(ctx: StrategyAuditContext, profile: StrategyIndustryProfileRef, lang: StrategyLang): string[] {
	const fromProfile = getIndustryProfile(profile.registryType);
	return unique([
		...profile.specialties,
		ctx.subIndustry,
		ctx.entities.businessEntity,
		fromProfile.mainService[lang],
	]).slice(0, 3);
}

function auditCorpus(ctx: StrategyAuditContext, profile: StrategyIndustryProfileRef): string {
	return squeeze(
		[
			ctx.siteName,
			ctx.industry,
			ctx.subIndustry,
			ctx.location,
			ctx.localSignals.location,
			ctx.localSignals.broadLocation,
			ctx.entities.brandName,
			ctx.entities.organizationName,
			ctx.entities.representativeName,
			ctx.entities.businessEntity,
			...ctx.entities.phrases,
			...profile.specialties,
		].join(' '),
	);
}

function mentions(corpus: string, phrase: string | null | undefined): boolean {
	const needle = squeeze(phrase || '');
	return Boolean(needle) && corpus.includes(needle);
}

export function hostFromUrl(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || url;
	}
}

export function detectSearchIntents(
	keyword: string,
	_ctx?: StrategyAuditContext,
	_profile?: StrategyIndustryProfileRef,
): SearchIntentId[] {
	return detectIntentsFromNormalized(normalizeKeyword(keyword));
}

export { buildExampleKeywords, buildRecommendedKeywordGroups } from '@/lib/strategy/recommended-keywords';

function profileSignals(profile: StrategyIndustryProfileRef, lang: StrategyLang): StrategyProfileSignal[] {
	const emphasized = new Set(EMPHASIS[profile.registryType] ?? EMPHASIS.general);
	return COMMON_SIGNALS.map((signal) => ({
		id: signal.id,
		label: signal.id === 'entity' ? (lang === 'en' ? 'Entity' : `${profile.label} Entity`) : signal[lang],
		emphasized: emphasized.has(signal.id),
	}));
}

function entityGraph(
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	parsed: ReturnType<typeof normalizeKeyword>,
	lang: StrategyLang,
): StrategyEntityNode[] {
	const catalog = getIndustryProfile(profile.registryType);
	const corpus = auditCorpus(ctx, profile);
	const brand = compact(ctx.siteName || ctx.entities.brandName);
	const person = compact(ctx.entities.representativeName);
	const place = compact(ctx.location || ctx.localSignals.broadLocation);
	const orgLinked = ctx.entities.schemaTypes.some((type) =>
		/organization|localbusiness|clinic|hospital|service|restaurant|school|dentist/i.test(type),
	);
	const serviceFocus = parsed.service || parsed.industry || compact(profile.specialties[0] || ctx.subIndustry);
	const topicFocus = parsed.problem || compact(ctx.entities.businessEntity || ctx.entities.phrases[0]);

	const serviceStatus: EntityCoverage = parsed.service
		? mentions(corpus, parsed.service)
			? 'present'
			: 'missing'
		: parsed.industry
			? mentions(corpus, parsed.industry) || profile.specialties.length > 0
				? 'present'
				: 'partial'
			: profile.specialties.length
				? 'partial'
				: 'missing';

	const topicStatus: EntityCoverage = parsed.problem
		? mentions(corpus, parsed.problem)
			? 'present'
			: 'missing'
		: topicFocus
			? 'partial'
			: 'missing';

	const locationStatus: EntityCoverage = (() => {
		if (!parsed.location.length) return place ? 'partial' : 'missing';
		const auditPlace = squeeze(place);
		if (!auditPlace) return 'missing';
		if (hasDistrictLocation(parsed)) {
			const districtTokens = parsed.location.filter((token) => hasDistrictLocation({ ...parsed, location: [token] }));
			return districtTokens.every((token) => auditPlace.includes(squeeze(token))) ? 'present' : 'partial';
		}
		return parsed.location.some((token) => auditPlace.includes(squeeze(token))) ? 'present' : 'missing';
	})();

	return [
		{
			id: 'institution',
			role: catalog.defaultCategory[lang],
			label: catalog.schemaType,
			status: orgLinked ? 'present' : brand ? 'partial' : 'missing',
		},
		{
			id: 'person',
			role: catalog.personJobTitle[lang],
			label: person || catalog.personJobTitle[lang],
			status: person ? 'present' : orgLinked ? 'partial' : 'missing',
		},
		{
			id: 'service',
			role: lang === 'en' ? 'Service' : '서비스',
			label: serviceFocus || (lang === 'en' ? 'Service not extracted' : '서비스 미추출'),
			status: serviceStatus,
		},
		{
			id: 'topic',
			role: lang === 'en' ? 'Condition / topic' : '증상 / 주제',
			label: topicFocus || (lang === 'en' ? 'Topic not extracted' : '주제 미추출'),
			status: topicStatus,
		},
		{
			id: 'place',
			role: lang === 'en' ? 'Location' : '지역',
			label: locationLabel(parsed) || place || (lang === 'en' ? 'Region not extracted' : '지역 미추출'),
			status: locationStatus,
		},
	];
}

function qualitativeContent(ctx: StrategyAuditContext, lang: StrategyLang): string {
	const length = ctx.contentSignals.bodyTextLength;
	if (typeof length === 'number' && length >= 1200) return lang === 'en' ? 'Body copy is present' : '본문 콘텐츠 확보';
	if (typeof length === 'number') return lang === 'en' ? `Body is short (${length} chars)` : `본문이 짧음 (${length}자)`;
	return lang === 'en' ? 'Content volume not measured as a score' : '콘텐츠 전용 점수 없음';
}

function qualitativeAeo(ctx: StrategyAuditContext, lang: StrategyLang): string {
	const faqs = ctx.contentSignals.faqCount ?? 0;
	if (hasFaqSchema(ctx) && faqs > 0) return lang === 'en' ? `FAQ present (${faqs})` : `FAQ 확보 (${faqs})`;
	if (faqs > 0) return lang === 'en' ? 'On-page Q&A without FAQ schema' : '본문 Q&A는 있으나 FAQ 스키마 없음';
	return lang === 'en' ? 'Question-form content is thin' : '질문형 콘텐츠 부족';
}

function qualitativeTrust(ctx: StrategyAuditContext, lang: StrategyLang): string {
	if (ctx.trustSignals.sameAsCount > 0 && ctx.entities.representativeName) {
		return lang === 'en' ? 'Person + sameAs signals found' : '인물·sameAs 신호 확인';
	}
	if (ctx.trustSignals.sameAsCount > 0) return lang === 'en' ? 'sameAs links found' : 'sameAs 링크 확인';
	return lang === 'en' ? 'External identity links are thin' : '외부 정체성 링크 부족';
}

function comparison(ctx: StrategyAuditContext, lang: StrategyLang): StrategyAxisCompare[] {
	const goal = lang === 'en' ? 'Recommended level' : '권장 수준';
	const hint = lang === 'en' ? 'Strategic target — not a live rank forecast' : '전략 목표 · 순위 예측이 아닙니다';
	return [
		{
			axis: 'Entity',
			currentLabel:
				ctx.scores.entity != null
					? `${ctx.scores.entity.value}`
					: lang === 'en'
						? 'No standalone entity score'
						: '엔티티 단독 점수 없음',
			currentValue: ctx.scores.entity?.value,
			targetLabel: goal,
			targetHint: hint,
		},
		{
			axis: 'Local',
			currentLabel:
				ctx.scores.local != null
					? `${ctx.scores.local.value}`
					: lang === 'en'
						? 'No standalone local score'
						: '로컬 단독 점수 없음',
			currentValue: ctx.scores.local?.value,
			targetLabel: goal,
			targetHint: hint,
		},
		{
			axis: 'Content',
			currentLabel: qualitativeContent(ctx, lang),
			targetLabel: goal,
			targetHint: hint,
		},
		{
			axis: 'AEO',
			currentLabel: qualitativeAeo(ctx, lang),
			targetLabel: goal,
			targetHint: hint,
		},
		{
			axis: 'Trust',
			currentLabel: qualitativeTrust(ctx, lang),
			targetLabel: goal,
			targetHint: hint,
		},
		{
			axis: 'Schema',
			currentLabel:
				typeof ctx.schema.coverage === 'number'
					? `${Math.round(ctx.schema.coverage)}`
					: ctx.schema.types.length
						? ctx.schema.types.slice(0, 2).join(', ')
						: lang === 'en'
							? 'Schema types not detected'
							: '스키마 타입 미검출',
			currentValue: typeof ctx.schema.coverage === 'number' ? Math.round(ctx.schema.coverage) : undefined,
			targetLabel: goal,
			targetHint: hint,
		},
	];
}

function searchSurfaces(
	intents: SearchIntentId[],
	parsed: ReturnType<typeof normalizeKeyword>,
	lang: StrategyLang,
): StrategySearchSurface[] {
	const has = (id: SearchIntentId) => intents.includes(id);
	const portal =
		has('local') || has('category') || has('service') || has('list') || has('comparison') || has('recommendation');
	const generative = has('problem') || has('naturalLanguage') || has('aiRecommendation') || has('recommendation');
	const relatedNote =
		lang === 'en'
			? 'Related environment for this query shape — not a ranking guarantee.'
			: '이 질의 형태와 관련된 환경입니다. 상위 노출을 보장하지 않습니다.';
	const idleNote =
		lang === 'en'
			? 'Less central for this query shape.'
			: '이 질의 형태에서는 상대적으로 덜 중심입니다.';

	return [
		{
			id: 'naver',
			label: 'NAVER',
			related: portal || Boolean(parsed.location.length),
			reason: portal
				? lang === 'en'
					? 'Local / category / list queries often surface in portal results.'
					: '지역·카테고리·리스트 질의와 포털 결과 환경이 맞닿아 있습니다.'
				: idleNote,
		},
		{
			id: 'google',
			label: 'GOOGLE',
			related: portal || generative,
			reason: relatedNote,
		},
		{
			id: 'chatgpt',
			label: 'CHATGPT',
			related: generative,
			reason: generative
				? lang === 'en'
					? 'Problem, recommendation, and natural-language queries overlap answer-engine prompts.'
					: '문제·추천·자연어 질의는 답변형 엔진 프롬프트와 겹칩니다.'
				: idleNote,
		},
		{
			id: 'gemini',
			label: 'GEMINI',
			related: generative,
			reason: generative
				? lang === 'en'
					? 'Answer-form queries can be assembled in generative search.'
					: '답변형 질의가 생성형 검색에서 재구성될 수 있습니다.'
				: idleNote,
		},
		{
			id: 'perplexity',
			label: 'PERPLEXITY',
			related: generative || has('comparison') || has('list'),
			reason:
				generative || has('comparison') || has('list')
					? lang === 'en'
						? 'Comparison and source-seeking queries overlap citation-style engines.'
						: '비교·근거 탐색 질의는 인용형 엔진과 겹칩니다.'
					: idleNote,
		},
	];
}

function rankPriority(score: number): StrategyPriorityLevel {
	if (score >= 6) return 'HIGH';
	if (score >= 3) return 'MEDIUM';
	return 'LOW';
}

function buildGaps(input: {
	ctx: StrategyAuditContext;
	profile: StrategyIndustryProfileRef;
	parsed: ReturnType<typeof normalizeKeyword>;
	intents: SearchIntentId[];
	entities: StrategyEntityNode[];
	lang: StrategyLang;
}): StrategyGap[] {
	const { ctx, profile, parsed, intents, entities, lang } = input;
	const catalog = getIndustryProfile(profile.registryType);
	const person = catalog.personJobTitle[lang];
	const focus = focusPhrase(parsed);
	const loc = locationLabel(parsed) || compact(ctx.location);
	const emphasized = new Set(EMPHASIS[profile.registryType] ?? EMPHASIS.general);
	const entityOf = (id: string) => entities.find((node) => node.id === id);
	const hasIntent = (id: SearchIntentId) => intents.includes(id);
	const district = hasDistrictLocation(parsed);

	const contentThin =
		(typeof ctx.contentSignals.bodyTextLength === 'number' && ctx.contentSignals.bodyTextLength < 800) ||
		!ctx.contentSignals.h1Count;
	const aeoThin = (ctx.contentSignals.faqCount ?? 0) === 0 || !hasFaqSchema(ctx);
	const localWeak =
		(ctx.scores.local != null && ctx.scores.local.value < 55) ||
		(!ctx.localSignals.telephone && !ctx.localSignals.address);
	const trustThin = ctx.trustSignals.sameAsCount === 0;
	const schemaThin = typeof ctx.schema.coverage === 'number' ? ctx.schema.coverage < 55 : ctx.schema.types.length === 0;
	const serviceMissing = entityOf('service')?.status === 'missing';
	const topicMissing = entityOf('topic')?.status === 'missing';
	const coverageByCode = new Map(
		measureAxisCoverage({
			ctx,
			parsed,
			intents,
			entities,
			emphasized,
			lang,
		}).map((row) => [row.code, row]),
	);

	const rows: Array<Omit<StrategyGap, 'priority' | 'weight'> & { score: number }> = [
		{
			id: 'entity-gap',
			code: 'ENTITY',
			score:
				(emphasized.has('entity') ? 2 : 0) +
				(serviceMissing ? 3 : 0) +
				(topicMissing && hasIntent('problem') ? 2 : 0) +
				(entityOf('person')?.status !== 'present' ? 1 : 0) +
				(hasIntent('service') ? 2 : 0),
			title: 'ENTITY GAP',
			current: serviceMissing
				? lang === 'en'
					? `The official page does not yet name “${focus}” as an entity.`
					: `공식 페이지에 “${focus}” Entity가 아직 없습니다.`
				: lang === 'en'
					? 'Service, person, and topic entities are only partly linked.'
					: '서비스·인물·주제 Entity가 부분적으로만 연결되어 있습니다.',
			strategy:
				lang === 'en'
					? `Bind ${focus} → ${person} → ${catalog.schemaType} → ${loc || 'region'}`
					: `${focus} → ${person} → ${catalog.schemaType} → ${loc || '지역'} 관계를 고정합니다`,
			why: hasIntent('service')
				? lang === 'en'
					? `“${parsed.service}” is a service-shaped query, so missing that entity leaves nothing to cite.`
					: `${attachQuotedPostposition(parsed.service || focus, '은/는')} 서비스형 질의인데 해당 Entity가 없으면 인용 단위가 없습니다.`
				: lang === 'en'
					? 'Engines need a readable graph from organization to service to place.'
					: '엔진이 기관-서비스-지역을 한 그래프로 읽어야 합니다.',
			what:
				lang === 'en'
					? `State ${focus} in the official entity sentence and schema.`
					: `공식 Entity 문장과 스키마에 ${attachPostposition(focus, '을/를')} 명시합니다.`,
			how: [catalog.schemaType, person, focus, loc || (lang === 'en' ? 'Location' : '지역')],
			expectedImpact:
				lang === 'en'
					? 'The official site becomes easier to treat as the source for this entity, not a ranking promise.'
					: '해당 Entity의 공식 출처로 읽히기 쉬워집니다. 순위 보장이 아닙니다.',
		},
		{
			id: 'local-gap',
			code: 'LOCAL',
			score:
				(emphasized.has('local') ? 2 : 0) +
				(hasIntent('local') ? 2 : 0) +
				(district ? 2 : 0) +
				(localWeak ? 2 : 0) +
				(entityOf('place')?.status === 'partial' ? 1 : 0),
			title: 'LOCAL GAP',
			current: district
				? lang === 'en'
					? `District-level query (${locationLabel(parsed)}) needs matching NAP and landing copy.`
					: `구 단위 질의(${locationLabel(parsed)})에 맞는 NAP·랜딩 문구가 필요합니다.`
				: lang === 'en'
					? 'City-level query — district / neighborhood proof is still thin.'
					: '도시 단위 질의입니다. 구·동 단위 근거는 아직 얇습니다.',
			strategy: district
				? lang === 'en'
					? `Align NAP and on-page copy to ${locationLabel(parsed)}.`
					: `${locationLabel(parsed)} 기준으로 NAP와 본문 문구를 맞춥니다.`
				: lang === 'en'
					? 'Keep city identity consistent, then add a district landing if you serve one area.'
					: '도시 정체성을 맞춘 뒤, 실제 상권이면 구 단위 랜딩을 추가합니다.',
			why: hasIntent('local')
				? lang === 'en'
					? 'Local intent only holds when place identity matches the query grain.'
					: '로컬 의도는 질의 단위와 장소 정체성이 같을 때만 유지됩니다.'
				: lang === 'en'
					? 'Place signals are incomplete for this query.'
					: '이 질의에 대한 장소 신호가 불완전합니다.',
			what:
				lang === 'en'
					? 'Publish matching address, hours, and regional service lines.'
					: '주소·영업시간·지역 서비스 문구를 일치시켜 공개합니다.',
			how: lang === 'en' ? ['NAP', 'Map / geo', district ? 'District H2' : 'City H2'] : ['NAP', '지도 / geo', district ? '구 단위 H2' : '도시 H2'],
			expectedImpact:
				lang === 'en'
					? 'The official place record becomes internally consistent for this local query.'
					: '이 지역 질의에 대해 공식 장소 정보가 내부적으로 일치합니다.',
		},
		{
			id: 'content-gap',
			code: 'CONTENT',
			score:
				(emphasized.has('content') ? 2 : 0) +
				(contentThin ? 2 : 0) +
				(hasIntent('category') ? 2 : 0) +
				(hasIntent('service') || hasIntent('problem') ? 2 : 0),
			title: 'CONTENT GAP',
			current: hasIntent('problem')
				? lang === 'en'
					? `Little decision-guide copy exists for the problem “${parsed.problem}”.`
					: `“${parsed.problem}” 문제에 대한 판단 가이드 본문이 부족합니다.`
				: hasIntent('service')
					? lang === 'en'
						? `“${parsed.service}” is not explained as a selection criterion.`
						: `${attachQuotedPostposition(parsed.service || focus, '을/를')} 선택 기준으로 설명한 본문이 없습니다.`
					: qualitativeContent(ctx, lang),
			strategy:
				lang === 'en'
					? `Write a criteria guide around ${focus}, not a slogan.`
					: `슬로건이 아니라 ${focus} 기준 설명형 가이드를 작성합니다.`,
			why:
				lang === 'en'
					? 'Thin pages give answer engines little they can quote for this query.'
					: '얇은 본문은 이 질의에 대해 인용할 단위가 없습니다.',
			what:
				lang === 'en'
					? `Cover why someone searches ${focus} and what to verify.`
					: `${attachPostposition(focus, '을/를')} 찾는 이유와 확인 항목을 본문에 적습니다.`,
			how: lang === 'en' ? ['H1 criteria', 'H2 questions', 'Proof lines'] : ['H1 기준', 'H2 질문', '근거 문장'],
			expectedImpact:
				lang === 'en'
					? 'The page gains extractable sections for this query. That is not a rank guarantee.'
					: '이 질의에 대해 추출 가능한 섹션이 생깁니다. 순위 보장이 아닙니다.',
		},
		{
			id: 'aeo-gap',
			code: 'AEO',
			score:
				(emphasized.has('aeo') ? 2 : 0) +
				(aeoThin ? 2 : 0) +
				(hasIntent('problem') ? 3 : 0) +
				(hasIntent('naturalLanguage') || hasIntent('aiRecommendation') ? 2 : 0) +
				(hasIntent('recommendation') ? 1 : 0),
			title: 'AEO GAP',
			current: hasIntent('problem')
				? lang === 'en'
					? `No direct answer block for “${parsed.problem}”.`
					: `“${parsed.problem}”에 대한 직접 답변 블록이 없습니다.`
				: qualitativeAeo(ctx, lang),
			strategy:
				lang === 'en'
					? `Add a question / answer pair that names ${focus}.`
					: `${attachPostposition(focus, '을/를')} 이름으로 쓰는 질문-답변 쌍을 추가합니다.`,
			why:
				lang === 'en'
					? 'Answer engines look for a short, citable reply, not a brochure.'
					: '답변 엔진은 브로슈어가 아니라 짧은 인용 가능한 답을 찾습니다.',
			what: lang === 'en' ? 'Publish FAQ + a first-paragraph answer.' : 'FAQ와 첫 문단 직접 답변을 공개합니다.',
			how: lang === 'en' ? ['FAQ', 'Direct answer', 'Entity sentence'] : ['FAQ', '직접 답변', 'Entity 문장'],
			expectedImpact:
				lang === 'en'
					? 'The query has a reusable answer unit. Citation is still not guaranteed.'
					: '이 질의에 재사용 가능한 답변 단위가 생깁니다. 인용을 보장하지는 않습니다.',
		},
		{
			id: 'trust-gap',
			code: 'TRUST',
			score:
				(emphasized.has('trust') ? 2 : 0) +
				(trustThin ? 2 : 0) +
				(hasIntent('recommendation') || hasIntent('aiRecommendation') ? 2 : 0) +
				(entityOf('person')?.status !== 'present' ? 1 : 0),
			title: 'TRUST GAP',
			current: qualitativeTrust(ctx, lang),
			strategy:
				lang === 'en'
					? `Connect official sameAs and the ${person} identity.`
					: `공식 sameAs와 ${person} 정체성을 연결합니다.`,
			why:
				lang === 'en'
					? 'Recommendation-shaped queries weigh whether the official site is citable.'
					: '추천형 질의는 공식 사이트를 출처로 삼을지부터 봅니다.',
			what: lang === 'en' ? `Expose ${person} and official profiles.` : `${attachPostposition(person, '과/와')} 공식 프로필을 노출합니다.`,
			how: ['sameAs', person, lang === 'en' ? 'Official profiles' : '공식 프로필'],
			expectedImpact:
				lang === 'en'
					? 'Identity evidence for this brand becomes easier to verify.'
					: '이 브랜드의 정체성 근거를 확인하기 쉬워집니다.',
		},
		{
			id: 'schema-gap',
			code: 'SCHEMA',
			score:
				(schemaThin ? 2 : 0) +
				(hasIntent('problem') || hasIntent('aiRecommendation') ? 2 : 0) +
				(serviceMissing ? 1 : 0) +
				(emphasized.has('entity') ? 1 : 0),
			title: 'SCHEMA GAP',
			current:
				typeof ctx.schema.coverage === 'number'
					? lang === 'en'
						? `Coverage ${Math.round(ctx.schema.coverage)}`
						: `커버리지 ${Math.round(ctx.schema.coverage)}`
					: lang === 'en'
						? 'Core schema types missing'
						: '핵심 스키마 타입 부족',
			strategy:
				lang === 'en'
					? `Complete ${catalog.schemaType} + FAQPage for ${focus}.`
					: `${focus} 기준으로 ${catalog.schemaType} + FAQPage를 완성합니다.`,
			why:
				lang === 'en'
					? 'Structured data is how engines lock the official graph for this query.'
					: '구조화 데이터는 엔진이 이 질의의 공식 그래프를 고정하는 방식입니다.',
			what: lang === 'en' ? 'Ship the official graph, not leftover types.' : '남은 타입이 아니라 공식 그래프를 넣습니다.',
			how: unique([catalog.schemaType, 'FAQPage', person, hasIntent('problem') ? 'FAQPage' : focus]),
			expectedImpact:
				lang === 'en'
					? 'Machines can attach this page to the intended entity. Visibility is not promised.'
					: '기계가 이 페이지를 의도한 Entity에 붙이기 쉬워집니다. 노출을 약속하지 않습니다.',
		},
	];

	return rows
		.map((row) => {
			const { score, ...gap } = row;
			const coverage = coverageByCode.get(row.code);
			const priority = coverage?.gapLevel ?? rankPriority(score);
			return { ...gap, weight: score, priority };
		})
		.sort((a, b) => {
			const rank: Record<StrategyPriorityLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
			if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
			return b.weight - a.weight;
		});
}


function executionSample(
	keyword: string,
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	parsed: ReturnType<typeof normalizeKeyword>,
	_intents: SearchIntentId[],
	lang: StrategyLang,
): StrategyExecutionSample {
	const catalog = getIndustryProfile(profile.registryType);
	const services = servicesOf(ctx, profile, lang);
	const loc = locationLabel(parsed) || compact(ctx.location);
	const focus = focusPhrase(parsed);
	const brand = compact(ctx.siteName) || catalog.label[lang];
	const person = catalog.personJobTitle[lang];
	const placeBit = loc ? (lang === 'en' ? `${loc} ` : `${loc} `) : '';
	const host = hostFromUrl(ctx.url);

	const title = parsed.problem
		? lang === 'en'
			? `${placeBit}${parsed.problem} criteria guide | ${brand}`
			: `${placeBit}${parsed.problem} 기준 안내 | ${brand}`
		: parsed.service
			? lang === 'en'
				? `${placeBit}${parsed.service} selection criteria | ${brand}`
				: `${placeBit}${parsed.service} 선택 기준 | ${brand}`
			: lang === 'en'
				? `${placeBit}${focus} selection guide | ${services[0] || catalog.mainService.en} criteria`
				: `${placeBit}${focus} 선택 가이드 | ${services[0] || catalog.mainService.ko} 기준`;

	const metaDescription = parsed.problem
		? lang === 'en'
			? `${brand} explains what to verify when searching ${focus} in ${loc || 'your area'}. Not a ranking claim.`
			: `${loc || '해당 지역'}에서 ${attachPostposition(focus, '을/를')} 찾을 때 확인할 기준을 ${brand} 공식 페이지 기준으로 정리합니다.`
		: lang === 'en'
			? `${brand} lists selection criteria for ${focus}${loc ? ` in ${loc}` : ''}. Official facts only.`
			: `${loc ? `${loc} ` : ''}${attachPostposition(focus, '을/를')} 선택할 때 확인할 공식 기준을 ${brand} 페이지에서 확인하세요.`;

	const h1 = parsed.problem
		? lang === 'en'
			? `What to check when you search ${focus}`
			: `${attachPostposition(focus, '을/를')} 찾을 때 확인해야 할 기준`
		: parsed.service
			? lang === 'en'
				? `How to evaluate ${focus}`
				: `${attachPostposition(focus, '을/를')} 평가할 때 확인할 기준`
			: lang === 'en'
				? `What to check when choosing ${focus}`
				: `${attachPostposition(focus, '을/를')} 선택할 때 확인해야 할 기준`;

	const h2 = parsed.problem
		? lang === 'en'
			? [
					`What problem are you trying to solve with ${focus}?`,
					`How should you verify ${person} and the official scope?`,
					`Which local facts should match before you treat the page as a source?`,
				]
			: [
					`${attachPostposition(focus, '으로/로')} 해결하려는 문제는 무엇인가요?`,
					`${attachPostposition(person, '과/와')} 공식 범위는 어떻게 확인해야 하나요?`,
					`출처로 삼기 전에 어떤 지역 정보가 일치해야 하나요?`,
				]
		: parsed.service
			? lang === 'en'
				? [
						`What does “${parsed.service}” refer to on the official page?`,
						`How is ${parsed.service} related to ${person} and ${catalog.schemaType}?`,
						`${loc || 'Local'} signals that should match this service`,
					]
				: [
						`공식 페이지에서 ${attachQuotedPostposition(parsed.service, '은/는')} 무엇을 말하나요?`,
						`${attachPostposition(parsed.service, '은/는')} ${person}·${attachPostposition(catalog.schemaType, '과/와')} 어떻게 연결되나요?`,
						`${loc || '지역'} 정보 중 이 서비스와 일치해야 하는 항목`,
					]
			: lang === 'en'
				? [
						`What need are you searching ${focus} for?`,
						`How should you verify ${person} and the ${catalog.actionName.en} scope?`,
						`Which local signals should match before ${catalog.actionName.en}?`,
					]
				: [
						`어떤 이유로 ${attachPostposition(focus, '을/를')} 찾고 있나요?`,
						`${attachPostposition(person, '과/와')} ${catalog.actionName.ko} 범위는 어떻게 확인해야 하나요?`,
						`${catalog.actionName.ko} 전에 어떤 지역 정보가 일치해야 하나요?`,
					];

	const question = loc
		? parsed.problem
			? lang === 'en'
				? `What should I check for ${focus} in ${loc}?`
				: `${loc}에서 ${withJosa(focus, '을/를')} 찾을 때 무엇을 확인해야 하나요?`
			: lang === 'en'
				? `What should I check when choosing ${focus} in ${loc}?`
				: `${loc}에서 ${withJosa(focus, '을/를')} 선택할 때 무엇을 확인해야 하나요?`
		: parsed.problem
			? lang === 'en'
				? `What should I check for ${focus}?`
				: `${withJosa(focus, '을/를')} 찾을 때 무엇을 확인해야 하나요?`
			: lang === 'en'
				? `What should I check when choosing ${focus}?`
				: `${withJosa(focus, '을/를')} 선택할 때 무엇을 확인해야 하나요?`;

	const shortAnswer = parsed.problem
		? lang === 'en'
			? `Check that the official ${catalog.defaultCategory.en} names ${focus}, the ${person}, and matching ${loc || 'place'} contact details on the same page.`
			: `${attachPostposition(`공식 ${catalog.defaultCategory.ko}`, '이/가')} ${focus} 범위, ${person}, ${loc || '지역'} 주소·전화를 한 페이지에 밝히는지 확인하세요.`
		: parsed.service
			? lang === 'en'
				? `${brand} lists ${parsed.service} as an official service${loc ? ` in ${loc}` : ''}. Confirm the ${person} and matching place facts.`
				: `${withJosa(brand, '은/는')} ${loc ? `${loc}에서 ` : ''}${withJosa(parsed.service, '을/를')} 공식 서비스로 안내합니다. ${attachPostposition(person, '과/와')} 주소가 같은지 확인하세요.`
			: lang === 'en'
				? `When choosing ${focus}${loc ? ` in ${loc}` : ''}, first confirm the official ${catalog.defaultCategory.en}, the ${person}, the service scope, and matching address and phone.`
				: `${loc ? `${loc}에서 ` : ''}${withJosa(focus, '을/를')} 선택할 때는 공식 ${catalog.defaultCategory.ko}, ${person}, 서비스 범위, 주소·전화가 같은 페이지에 있는지를 먼저 확인하세요.`;

	const faqs = [
		{
			q: question,
			a: shortAnswer,
		},
		{
			q: loc
				? lang === 'en'
					? `Does this official page cover ${loc}?`
					: `이 공식 페이지는 ${loc} 정보를 다루나요?`
				: lang === 'en'
					? `How do I verify the official place identity?`
					: `공식 장소 정체성은 어떻게 확인하나요?`,
			a: loc
				? lang === 'en'
					? `Use the published address, hours, and geo fields and check they name ${loc}.`
					: `공개된 주소·영업시간·geo 필드가 ${attachPostposition(loc, '을/를')} 가리키는지 확인하세요.`
				: lang === 'en'
					? `Match the footer NAP with schema and the map listing.`
					: `푸터 NAP와 스키마, 지도 정보가 같은지 확인하세요.`,
		},
	];

	const answer = shortAnswer;

	const internalLinks = confirmedInternalUrls(ctx.pages);

	const offered = parsed.service || parsed.industry || focus;
	const entitySentence = loc
		? lang === 'en'
			? `${brand} is a ${catalog.defaultCategory.en} that provides ${offered} in ${loc}.`
			: `${withJosa(brand, '은/는')} ${loc}에서 ${withJosa(offered, '을/를')} 제공하는 ${catalog.defaultCategory.ko}입니다.`
		: lang === 'en'
			? `${brand} is a ${catalog.defaultCategory.en} that provides ${offered}.`
			: `${withJosa(brand, '은/는')} ${withJosa(offered, '을/를')} 제공하는 ${catalog.defaultCategory.ko}입니다.`;

	const schemaRecommendation = unique([
		catalog.schemaType,
		'FAQPage',
		person ? 'Person' : null,
		loc ? 'GeoCoordinates' : null,
		host ? `sameAs → ${host}` : null,
	]);

	return {
		keyword,
		title,
		metaDescription,
		h1,
		h2,
		faqs,
		answer,
		internalLinks,
		entitySentence,
		schemaRecommendation,
	};
}

export function analyzeStrategy(input: {
	keyword: string;
	ctx: StrategyAuditContext;
	profile: StrategyIndustryProfileRef;
	lang: StrategyLang;
}): StrategyResult | null {
	const keyword = compact(input.keyword);
	if (!keyword) return null;
	const { ctx, profile, lang } = input;
	const normalized = normalizeKeyword(keyword);
	const industry = matchIndustry(normalized, profile, lang);
	const intent = detectIntentsFromNormalized(normalized);
	const entities = entityGraph(ctx, profile, normalized, lang);
	const currentState = comparison(ctx, lang);
	const gaps = buildGaps({ ctx, profile, parsed: normalized, intents: intent, entities, lang });
	const strategies: StrategyMove[] = gaps.map((gap) => ({
		gapId: gap.id,
		title: gap.title,
		why: gap.why,
		what: gap.what,
		how: gap.how,
		expectedImpact: gap.expectedImpact,
	}));
	const priorities: StrategyPriorityItem[] = gaps.map((gap) => ({
		id: gap.id,
		level: gap.priority,
		title: gap.title,
	}));
	const samples = executionSample(keyword, ctx, profile, normalized, intent, lang);
	const { blueprint, actionPlan } = buildExecutionBlueprint({
		keyword,
		sample: samples,
		parsed: normalized,
		intents: intent,
		gaps,
		ctx,
		profile,
		lang,
	});

	const draft = {
		keyword,
		normalized,
		industry,
		intent,
		intents: intent,
		entities,
		searchSurfaces: searchSurfaces(intent, normalized, lang),
		currentState,
		targetState: currentState,
		gaps,
		priorities,
		strategies,
		samples,
		sample: samples,
		blueprint,
		actionPlan,
		profileCode: profile.registryType.toUpperCase(),
		specialtyCode: profile.specialties[0] || normalized.industry || null,
		profileSignals: profileSignals(profile, lang),
		comparison: currentState,
	};

	return {
		...draft,
		strategyMap: buildSearchStrategyMap({ result: draft, ctx, profile, lang }),
	};
}

export function catalogLabel(profile: StrategyIndustryProfileRef, lang: StrategyLang): string {
	return getIndustryProfile(profile.registryType).label[lang];
}
