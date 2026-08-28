import { attachPostposition, attachQuotedPostposition } from '@/lib/korean-josa';
import { getIndustryProfile } from '@/lib/registry/universalIndustryRegistry';
import { measureAxisCoverage, rankOfGapLevel } from '@/lib/strategy/axis-coverage';
import { focusPhrase, locationLabel } from '@/lib/strategy/normalize-keyword';
import type {
	EntityCoverage,
	KeywordPortfolio,
	QualitativeWeight,
	SearchIntentId,
	SearchStrategyMap,
	StrategyAuditContext,
	StrategyAxisCoverage,
	StrategyClusterNode,
	StrategyConfidence,
	StrategyEntityStatusItem,
	StrategyEntityTreeNode,
	StrategyGap,
	StrategyIndustryProfileRef,
	StrategyIntentWeight,
	StrategyJourneyStep,
	StrategyLang,
	StrategyMapPriority,
	StrategyResult,
	StrategySurfaceCard,
} from '@/lib/strategy/types';

type StrategyDraft = Omit<StrategyResult, 'strategyMap'>;

const INTENT_ORDER: SearchIntentId[] = [
	'local',
	'category',
	'service',
	'problem',
	'comparison',
	'recommendation',
	'list',
	'naturalLanguage',
	'aiRecommendation',
];

const INTENT_LABEL: Record<SearchIntentId, { ko: string; en: string }> = {
	local: { ko: 'LOCAL', en: 'LOCAL' },
	category: { ko: 'CATEGORY', en: 'CATEGORY' },
	service: { ko: 'SERVICE', en: 'SERVICE' },
	problem: { ko: 'PROBLEM SOLVING', en: 'PROBLEM SOLVING' },
	comparison: { ko: 'COMPARISON', en: 'COMPARISON' },
	recommendation: { ko: 'RECOMMENDATION', en: 'RECOMMENDATION' },
	list: { ko: 'LIST', en: 'LIST' },
	naturalLanguage: { ko: 'NATURAL LANGUAGE', en: 'NATURAL LANGUAGE' },
	aiRecommendation: { ko: 'AI RECOMMENDATION', en: 'AI RECOMMENDATION' },
};

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function intentWeights(intents: SearchIntentId[], lang: StrategyLang): StrategyIntentWeight[] {
	const core = new Set(intents.slice(0, 2));
	return INTENT_ORDER.map((id) => {
		let weight: QualitativeWeight = 'idle';
		if (core.has(id)) weight = 'primary';
		else if (intents.includes(id)) weight = 'secondary';
		return { id, label: INTENT_LABEL[id][lang], weight };
	});
}

function journeySteps(result: StrategyDraft, lang: StrategyLang): StrategyJourneyStep[] {
	const parsed = result.normalized;
	const steps: StrategyJourneyStep[] = [];
	if (parsed.location[0]) {
		steps.push({
			id: 'location',
			stage: 'location',
			label: lang === 'en' ? 'Place search' : '지역 검색',
			value: locationLabel(parsed),
		});
	}
	if (parsed.industry) {
		steps.push({
			id: 'industry',
			stage: 'industry',
			label: lang === 'en' ? 'Category' : '업종',
			value: parsed.industry,
		});
	}
	if (parsed.service) {
		steps.push({
			id: 'service',
			stage: 'service',
			label: lang === 'en' ? 'Service' : '서비스',
			value: parsed.service,
		});
	}
	if (parsed.problem) {
		steps.push({
			id: 'problem',
			stage: 'problem',
			label: lang === 'en' ? 'Problem' : '문제',
			value: parsed.problem,
		});
	}
	if (result.intent.includes('comparison')) {
		steps.push({
			id: 'comparison',
			stage: 'comparison',
			label: lang === 'en' ? 'Compare' : '비교',
			value: lang === 'en' ? 'Who meets the criteria?' : '기준을 충족하는 곳',
		});
	}
	if (result.intent.includes('recommendation') || result.intent.includes('aiRecommendation')) {
		steps.push({
			id: 'recommendation',
			stage: 'recommendation',
			label: lang === 'en' ? 'Recommend' : '추천',
			value: lang === 'en' ? 'Which official source is usable?' : '어떤 공식 출처를 쓸 수 있는가',
		});
	}
	if (result.intent.includes('naturalLanguage') || result.intent.includes('aiRecommendation') || result.intent.includes('problem')) {
		const focus = focusPhrase(parsed);
		const loc = locationLabel(parsed);
		steps.push({
			id: 'ai',
			stage: 'ai',
			label: lang === 'en' ? 'AI question' : 'AI 질문',
			value: loc
				? lang === 'en'
					? `What should I check for ${focus} in ${loc}?`
					: `${loc}에서 ${attachPostposition(focus, '을/를')} 찾을 때 무엇을 확인해야 하나요?`
				: lang === 'en'
					? `What should I check for ${focus}?`
					: `${attachPostposition(focus, '을/를')} 찾을 때 무엇을 확인해야 하나요?`,
		});
	}
	return steps;
}

function entityWhyWhat(
	node: { id: string; role: string; label: string; status: EntityCoverage },
	lang: StrategyLang,
): Pick<StrategyEntityStatusItem, 'whyNeeded' | 'whatToAdd'> {
	if (node.status === 'present') return {};
	const why =
		lang === 'en'
			? `${node.role} must be readable as part of the official graph for this query.`
			: `${attachPostposition(node.role, '이/가')} 이 질의의 공식 그래프에 읽혀야 합니다.`;
	const what =
		lang === 'en'
			? `Name “${node.label}” on the official page and in schema.`
			: `공식 페이지와 스키마에 ${attachQuotedPostposition(node.label, '을/를')} 명시합니다.`;
	return { whyNeeded: why, whatToAdd: what };
}

function entityTree(result: StrategyDraft, ctx: StrategyAuditContext, lang: StrategyLang): StrategyEntityTreeNode {
	const byId = (id: string) => result.entities.find((node) => node.id === id);
	const brand = compact(ctx.siteName) || (lang === 'en' ? 'Brand' : '브랜드');
	const institution = byId('institution');
	const person = byId('person');
	const service = byId('service');
	const topic = byId('topic');
	const place = byId('place');
	const locTokens = result.normalized.location;

	const placeChildren: StrategyEntityTreeNode[] = locTokens.slice(1).map((token) => ({
		id: `place-${token}`,
		role: lang === 'en' ? 'Place grain' : '지역 단위',
		label: token,
		status: place?.status ?? 'missing',
		children: [],
	}));

	const serviceNode: StrategyEntityTreeNode | null = service
		? {
				id: service.id,
				role: service.role,
				label: service.label,
				status: service.status,
				children: topic
					? [{ id: topic.id, role: topic.role, label: topic.label, status: topic.status, children: [] }]
					: [],
			}
		: null;

	return {
		id: 'brand',
		role: lang === 'en' ? 'Brand' : '브랜드',
		label: brand,
		status: institution?.status === 'present' ? 'present' : 'partial',
		children: [
			institution
				? {
						id: institution.id,
						role: institution.role,
						label: institution.label,
						status: institution.status,
						children: serviceNode ? [serviceNode] : [],
					}
				: null,
			person
				? { id: person.id, role: person.role, label: person.label, status: person.status, children: [] }
				: null,
			place
				? {
						id: place.id,
						role: place.role,
						label: place.label,
						status: place.status,
						children: placeChildren,
					}
				: null,
		].filter((node): node is StrategyEntityTreeNode => Boolean(node)),
	};
}

function entityStatus(result: StrategyDraft, lang: StrategyLang): StrategyEntityStatusItem[] {
	return result.entities.map((node) => ({
		id: node.id,
		role: node.role,
		label: node.label,
		status: node.status,
		...entityWhyWhat(node, lang),
	}));
}

function surfaceCards(result: StrategyDraft, lang: StrategyLang): StrategySurfaceCard[] {
	const modelNote =
		lang === 'en'
			? 'REDUE strategy model — typical signals to consider, not a claimed platform algorithm.'
			: 'REDUE 전략 모델 기준 · 일반적으로 고려할 수 있는 검색 신호입니다. 플랫폼 내부 알고리즘을 안다고 주장하지 않습니다.';
	const naver = [
		{ id: 'local', label: 'Local' },
		{ id: 'place', label: 'Place' },
		{ id: 'content', label: 'Content' },
		{ id: 'reviews', label: 'Reviews' },
	];
	const google = [
		{ id: 'entity', label: 'Entity' },
		{ id: 'local', label: 'Local' },
		{ id: 'content', label: 'Content' },
		{ id: 'schema', label: 'Structured Data' },
	];
	const ai = [
		{ id: 'entity', label: 'Entity' },
		{ id: 'qa', label: 'Question Answer' },
		{ id: 'source', label: 'Source Content' },
		{ id: 'authority', label: 'Authority' },
		{ id: 'context', label: 'Context' },
	];
	const signalsFor = (id: StrategySurfaceCard['id']) => {
		if (id === 'naver') return naver;
		if (id === 'google') return google;
		return ai;
	};
	return result.searchSurfaces.map((surface) => ({
		...surface,
		signals: signalsFor(surface.id),
		modelNote,
	}));
}

function coverageRows(result: StrategyDraft, ctx: StrategyAuditContext, lang: StrategyLang): StrategyAxisCoverage[] {
	const emphasized = new Set(
		(result.profileSignals || []).filter((signal) => signal.emphasized).map((signal) => signal.id),
	);
	return measureAxisCoverage({
		ctx,
		parsed: result.normalized,
		intents: result.intent,
		entities: result.entities,
		emphasized,
		lang,
		currentState: result.currentState,
	});
}

function mapPriorities(gaps: StrategyGap[], lang: StrategyLang): StrategyMapPriority[] {
	return gaps.map((gap) => ({
		id: gap.id,
		rank: rankOfGapLevel(gap.priority),
		title: gap.title,
		whyFirst:
			gap.priority === 'HIGH'
				? lang === 'en'
					? `This gap is P0 because the query’s primary intent is blocked by the current ${gap.code.toLowerCase()} state.`
					: `이 질의의 핵심 의도가 현재 ${gap.code} 상태에서 막혀 P0입니다.`
				: gap.priority === 'MEDIUM'
					? lang === 'en'
						? `Important after P0 — it strengthens the official graph but is not the first blocker.`
						: `P0 다음입니다. 공식 그래프를 강화하지만 첫 차단 요인은 아닙니다.`
					: lang === 'en'
						? 'Useful later. It does not block this query’s first move.'
						: '이후에 보완합니다. 이 질의의 첫 작업을 막지는 않습니다.',
		why: gap.why,
		what: gap.what,
		how: gap.how,
	}));
}

function contentCluster(result: StrategyDraft, ctx: StrategyAuditContext, lang: StrategyLang): StrategyClusterNode {
	const pageOf = (role: StrategyClusterNode['role']) => ctx.pages.find((page) => page.role === role) || null;
	const home = pageOf('home') || ctx.pages.find((page) => page.source === 'audit-url') || null;
	const servicePage = pageOf('service');
	const conditionPage = pageOf('condition');
	const faqPage = pageOf('faq');

	const leaf = (
		id: string,
		label: string,
		role: string,
		page: { url: string; label: string } | null,
		children: StrategyClusterNode[] = [],
	): StrategyClusterNode => ({
		id,
		label,
		kind: page ? 'existing' : 'new',
		url: page?.url ?? null,
		role,
		children,
	});

	const faqChild = leaf('faq', 'FAQ', 'faq', faqPage);
	const parsed = result.normalized;
	const children: StrategyClusterNode[] = [];

	if (parsed.service) {
		children.push(leaf('service', parsed.service, 'service', servicePage, [faqChild]));
	} else if (parsed.industry) {
		children.push(leaf('industry', parsed.industry, 'service', servicePage, [faqChild]));
	}

	if (parsed.problem) {
		children.push(leaf('problem', parsed.problem, 'condition', conditionPage, [faqChild]));
	}

	const extra = compact(ctx.subIndustry);
	if (extra && extra !== parsed.industry && extra !== parsed.service && extra !== parsed.problem) {
		children.push(leaf(`extra-${extra}`, extra, 'service', servicePage));
	}

	if (!children.length) {
		children.push(faqChild);
	}

	return {
		id: 'hub',
		label: result.keyword,
		kind: home ? 'existing' : 'new',
		url: home?.url ?? ctx.url,
		role: 'home',
		children,
	};
}

function confidenceOf(
	result: StrategyDraft,
	ctx: StrategyAuditContext,
	lang: StrategyLang,
): StrategyConfidence {
	const measured = Boolean(ctx.scores.seo || ctx.scores.geo || ctx.scores.local || ctx.scores.entity);
	const reasons: string[] = [];
	if (measured) {
		reasons.push(lang === 'en' ? 'Built from measured audit axes.' : '실제 Audit 실측 축을 사용합니다.');
	}
	reasons.push(lang === 'en' ? 'Industry profile weights the strategic target.' : 'Industry Profile이 전략 목표를 가중합니다.');
	if (result.industry.relevance === 'low') {
		reasons.push(lang === 'en' ? 'Keyword industry does not match this audit.' : '검색어 업종이 진단 업종과 맞지 않습니다.');
		return {
			level: 'low',
			label: lang === 'en' ? 'LOW CONFIDENCE' : 'LOW CONFIDENCE',
			reasons,
		};
	}
	if (measured && result.industry.relevance === 'high') {
		return {
			level: 'high',
			label: lang === 'en' ? 'HIGH CONFIDENCE' : 'HIGH CONFIDENCE',
			reasons,
		};
	}
	if (!measured) {
		reasons.push(lang === 'en' ? 'Some axes use qualitative audit signals only.' : '일부 축은 정성 신호만 사용합니다.');
	}
	return {
		level: 'medium',
		label: lang === 'en' ? 'MEDIUM CONFIDENCE' : 'MEDIUM CONFIDENCE',
		reasons,
	};
}

function portfolioOf(keyword: string): KeywordPortfolio {
	return {
		version: 1,
		activeKeyword: keyword,
		slots: [{ keyword, active: true }],
	};
}

export function buildSearchStrategyMap(input: {
	result: StrategyDraft;
	ctx: StrategyAuditContext;
	profile: StrategyIndustryProfileRef;
	lang: StrategyLang;
}): SearchStrategyMap {
	const { result, ctx, profile, lang } = input;
	const catalog = getIndustryProfile(profile.registryType);
	const coverage = coverageRows(result, ctx, lang);
	const priorities = mapPriorities(result.gaps, lang);
	const loc = locationLabel(result.normalized) || compact(ctx.location) || null;
	const specialty = profile.specialties[0] || result.normalized.industry || null;
	const industryLabel = [catalog.label[lang], specialty].filter(Boolean).join(' / ');
	const primary = result.intent.slice(0, 2).map((id) => INTENT_LABEL[id][lang]);
	const top = priorities[0];
	const second = priorities[1];

	return {
		version: 1,
		keyword: result.keyword,
		industry: {
			type: profile.registryType,
			label: catalog.label[lang],
			specialty,
		},
		location: {
			tokens: result.normalized.location,
			display: loc,
		},
		intent: intentWeights(result.intent, lang),
		journey: journeySteps(result, lang),
		entityTree: entityTree(result, ctx, lang),
		entityStatus: entityStatus(result, lang),
		searchSurfaces: surfaceCards(result, lang),
		coverage,
		priorities,
		competition: ctx.competitors?.names.length
			? {
					ready: true,
					keyword: result.keyword,
					names: ctx.competitors.names,
					gapAxes: coverage.map((row) => row.axis),
					note: ctx.competitors.source || (lang === 'en' ? 'From the audit competitor snapshot.' : '진단에 포함된 경쟁 스냅샷입니다.'),
				}
			: {
					ready: false,
					keyword: result.keyword,
					names: [],
					gapAxes: coverage.map((row) => row.axis),
					note: lang === 'en' ? 'Competitor analysis data is not ready.' : '경쟁사 분석 데이터 준비 중',
				},
		contentCluster: contentCluster(result, ctx, lang),
		actionPlan: {
			today: result.actionPlan.today,
			thisWeek: result.actionPlan.thisWeek,
			next: result.actionPlan.next,
		},
		summary: {
			target: result.keyword,
			industry: industryLabel,
			location: loc,
			primaryIntent: primary.join(' + ') || (lang === 'en' ? 'Not extracted' : '미추출'),
			topGap: top?.title || (lang === 'en' ? 'None ranked' : '우선 갭 없음'),
			secondGap: second?.title || null,
			topAction: top?.what || result.actionPlan.today[0] || result.actionPlan.p0[0] || '',
		},
		confidence: confidenceOf(result, ctx, lang),
		portfolio: portfolioOf(result.keyword),
	};
}
