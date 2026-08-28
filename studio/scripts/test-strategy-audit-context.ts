import { analyzeStrategy, buildExampleKeywords, detectSearchIntents } from '../lib/strategy/common-engine';
import {
	applyCopilotOverride,
	buildCopilotContext,
	containsRankClaim,
	contextHasEngineFields,
	currentTextForTarget,
	heuristicRefine,
	parseCopilotRequest,
	sanitizeCopilotText,
} from '../lib/strategy/copilot';
import { buildStudioState } from '../lib/strategy/map-audit-context';
import type { AuditCategory, AuditCheckItem, AuditReport } from '../lib/site-auditor';

function check(id: string, status: 'pass' | 'fail' | 'warning', weight: number): AuditCheckItem {
	return { id, label: id, passed: status === 'pass', status, weight };
}

function category(id: string, score: number, maxScore: number, checks: AuditCheckItem[]): AuditCategory {
	return { id, label: id, score, maxScore, status: score === maxScore ? 'PASS' : 'WARN', statusNote: '', checks };
}

function report(): AuditReport {
	const categories = [
		category('security', 15, 15, [check('https', 'pass', 10), check('response-time', 'pass', 5)]),
		category('geo', 6, 12, [check('llms-txt', 'fail', 6), check('ai-bots-allowed', 'pass', 6)]),
	];
	return {
		url: 'https://clinic.example/',
		lang: 'ko',
		fetchedAt: '2026-08-16T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 80,
		pageSizeBytes: 20_000,
		score: 21,
		maxScore: 122,
		status: 'FAIR',
		statusLabel: '보통',
		hasSsl: true,
		schemaCoverage: 40,
		categories,
		checklist: categories.flatMap((item) => item.checks),
		findings: [{ severity: 'warning', title: 'llms.txt 없음', detail: '루트에 llms.txt가 없습니다.', checkId: 'llms-txt' }],
		metrics: {
			titleLength: 20,
			metaDescriptionLength: 80,
			h1Count: 1,
			headingSkipDetected: false,
			imagesTotal: 0,
			imagesMissingAlt: 0,
			imageAltCoveragePct: 100,
			jsonLdBlockCount: 1,
			schemaTypes: ['MedicalClinic'],
			bodyTextLength: 1800,
			renderBlockingScripts: 0,
		},
		siteMeta: {
			domain: 'clinic.example',
			brandName: '예제클리닉',
			category: '피부과',
			primaryKeyword: '피부과',
			industryType: 'MEDICAL',
			location: '대구 동구',
			broadLocation: '대구',
			vertical: 'medical',
			targetUrl: 'https://clinic.example/',
			coreSpecialties: ['피부과'],
			telephone: '053-000-0000',
			address: '대구광역시 동구',
		},
		collectedUrls: ['https://clinic.example/', 'https://clinic.example/about', 'https://clinic.example/service'],
		navItems: [
			{ name: '진료안내', url: 'https://clinic.example/service' },
			{ name: '의료진', url: 'https://clinic.example/about' },
		],
	};
}

let failed = 0;
function assert(label: string, ok: boolean, detail = '') {
	if (ok) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail  ${label}${detail ? ` — ${detail}` : ''}`);
}

const state = buildStudioState(report(), { auditId: 'audit-1', source: 'api', lang: 'ko' });
const ctx = state.auditContext;

assert('site url passed through', ctx?.url === 'https://clinic.example/');
assert('site name from brand', ctx?.siteName.includes('예제') || Boolean(ctx?.siteName));
assert('industry present', Boolean(ctx?.industry));
assert('sub-industry from specialties', ctx?.subIndustry === '피부과');
assert('location from siteMeta', ctx?.location === '대구 동구');
assert('SEO score exists', ctx?.scores.seo != null);
assert('GEO score exists', ctx?.scores.geo != null);
assert('AEO is not invented', ctx?.scores.aeo == null);
assert('Content is not invented', ctx?.scores.content == null);
assert('Trust is not invented', ctx?.scores.trust == null);
assert('issues include checklist fail', (ctx?.issues.length ?? 0) > 0);
assert('schema types from metrics', ctx?.schema.types.includes('MedicalClinic') === true);
assert('strategyResult stays empty', state.strategyResult == null);
	assert('keyword seed can be empty or inferred', typeof state.targetKeyword.value === 'string');
	assert('keyword seed is first-rank recommended', state.targetKeyword.seed === '대구 흉터 치료');

const profile = state.industryProfile;
if (ctx && profile) {
	const examples = buildExampleKeywords(ctx, profile, 'ko');
	assert('examples use audit location + specialty', examples.some((item) => item.includes('대구') && item.includes('피부과')));
	assert('examples keep high-intent derm procedures', examples.some((item) => item === '대구 흉터 치료') && examples.some((item) => item === '대구 리프팅'));
	assert('examples include AEO recommend chips', examples.includes('대구 흉터 치료 잘하는 곳') && examples.includes('대구 피부과 추천'));
	assert('examples include local hub chips', examples.includes('대구 동구 피부과') && examples.includes('동대구역 피부과'));
	assert('examples drop low-search admin nouns', examples.every((item) => !/피부시술|치료 솔루션|덴서티/.test(item)));
	const intents = detectSearchIntents('대구 피부과 추천', ctx, profile);
	assert(
		'local+category+recommendation from keyword',
		intents.includes('local') && intents.includes('category') && intents.includes('recommendation') && !intents.includes('service'),
	);
	const analyzed = analyzeStrategy({ keyword: '대구 피부과', ctx, profile, lang: 'ko' });
	assert('analysis returns gaps', (analyzed?.gaps.length ?? 0) > 0);
	assert('target is labeled as recommended level', analyzed?.comparison.every((row) => row.targetLabel === '권장 수준') === true);
	assert('sample is not a rank promise', Boolean(analyzed?.samples.title.includes('선택 가이드')));
	assert('result has search surfaces', (analyzed?.searchSurfaces.length ?? 0) === 5);
	assert('result has strategies with impact', Boolean(analyzed?.strategies[0]?.expectedImpact));

	const keywords = ['대구 피부과', '대구 동구 피부과', '대구 흉터 치료', '대구 덴서티', '대구 리프팅'] as const;
	const runs = keywords.map((keyword) => analyzeStrategy({ keyword, ctx, profile, lang: 'ko' }));
	assert('five keywords all analyze', runs.every(Boolean));

	const signatures = runs.map((run) =>
		JSON.stringify({
			intent: run?.intent,
			industry: run?.normalized.industry,
			service: run?.normalized.service,
			problem: run?.normalized.problem,
			location: run?.normalized.location,
			top: run?.gaps[0]?.id,
			title: run?.samples.title,
		}),
	);
	assert('five signatures are not identical', new Set(signatures).size === signatures.length, signatures.join(' | '));

	const [city, district, problem, density, lifting] = runs;
	assert('대구 피부과 is local+category', Boolean(city?.intent.includes('local') && city?.intent.includes('category') && !city?.intent.includes('service')));
	assert('대구 동구 피부과 keeps district token', Boolean(district?.normalized.location.includes('동구')));
	assert('district local gap mentions 동구', Boolean(district?.gaps.find((gap) => gap.code === 'LOCAL')?.current.includes('동구')));
	assert('city local gap is not district-level', Boolean(city?.gaps.find((gap) => gap.code === 'LOCAL')?.current.includes('도시')));
	assert(
		'district local priority is stricter',
		(district?.gaps.find((gap) => gap.code === 'LOCAL')?.weight ?? 0) > (city?.gaps.find((gap) => gap.code === 'LOCAL')?.weight ?? 0),
	);
	assert('흉터 치료 is problem intent', Boolean(problem?.intent.includes('problem') && problem?.normalized.problem?.includes('흉터')));
	assert('흉터 AEO is HIGH', problem?.gaps.find((gap) => gap.code === 'AEO')?.priority === 'HIGH');
	assert('덴서티 is leftover service', city?.normalized.service == null && density?.normalized.service === '덴서티');
	assert('리프팅 is leftover service', lifting?.normalized.service === '리프팅');
	assert('덴서티 service entity missing', density?.entities.find((node) => node.id === 'service')?.status === 'missing');
	assert('피부과 service entity present', city?.entities.find((node) => node.id === 'service')?.status === 'present');
	assert('덴서티 sample names 덴서티', Boolean(density?.samples.title.includes('덴서티')));
	assert('리프팅 sample names 리프팅', Boolean(lifting?.samples.title.includes('리프팅')));
	assert('samples are not rank promises', runs.every((run) => !/순위 상승|1위|보장/.test(JSON.stringify(run?.samples))));
	assert('industry match high for 피부과', city?.industry.relevance === 'high');
	assert('samples never use 피부시술를/피부시술는', runs.every((run) => !/피부시술를|피부시술는/.test(JSON.stringify(run?.samples))));
	assert('blueprint never uses 대표원장를', runs.every((run) => !/대표원장를/.test(JSON.stringify(run?.blueprint))));
	const skinSlug = analyzeStrategy({ keyword: '대구 동구 피부시술', ctx, profile, lang: 'ko' });
	assert(
		'slug does not repeat tokens',
		Boolean(skinSlug?.blueprint.seo.urlSlug) &&
			!/(피부시술).+\1/.test(skinSlug?.blueprint.seo.urlSlug || '') &&
			(skinSlug?.blueprint.seo.urlSlug.match(/피부시술/g)?.length ?? 0) <= 1,
	);
	const highEntity = analyzeStrategy({
		keyword: '대구 피부과',
		ctx: { ...ctx, scores: { ...ctx.scores, entity: { value: 100 } } },
		profile,
		lang: 'ko',
	});
	assert('entity 100 coverage is LOW', highEntity?.strategyMap.coverage.find((row) => row.code === 'ENTITY')?.gapLevel === 'LOW');
	assert('entity 100 gap is LOW / P2', highEntity?.gaps.find((gap) => gap.code === 'ENTITY')?.priority === 'LOW');
	assert('entity 100 map rank is P2', highEntity?.strategyMap.priorities.find((item) => item.id === 'entity-gap')?.rank === 'P2');
	assert(
		'gap rank matches coverage',
		highEntity?.gaps.every((gap) => {
			const row = highEntity.strategyMap.coverage.find((item) => item.code === gap.code);
			return row ? row.gapLevel === gap.priority : true;
		}) === true,
	);
	const mismatch = analyzeStrategy({ keyword: '대구 맛집', ctx, profile, lang: 'ko' });
	assert('맛집 vs medical is low relatedness', mismatch?.industry.relevance === 'low');

	assert('known pages include nav service', ctx.pages.some((page) => page.role === 'service' && page.url.includes('/service')));
	assert('known pages include person', ctx.pages.some((page) => page.role === 'person' && page.url.includes('/about')));
	const bp = city?.blueprint;
	assert('blueprint version is 1', bp?.version === 1);
	assert('page type is local+category guide', bp?.pageStrategy.pageType === 'local_industry_guide');
	assert('problem page type is specialist content', problem?.blueprint.pageStrategy.pageType === 'specialist_content');
	assert('service leftover is service hub', density?.blueprint.pageStrategy.pageType === 'service_hub');
	assert('canonical is the audited url', bp?.seo.canonical === 'https://clinic.example/');
	assert('slug is marked as draft', Boolean(bp?.seo.slugNote.includes('존재하는 URL이 아닙니다')));
	assert(
		'internal links do not invent paths',
		bp?.internalLinks.every((link) => !link.url || link.url.startsWith('https://clinic.example')) === true,
	);
	assert('service internal link uses confirmed url', bp?.internalLinks.some((link) => link.role === 'service' && link.url?.includes('/service')) === true);
	assert('condition link stays empty when missing', bp?.internalLinks.find((link) => link.role === 'condition')?.url == null);
	assert('local chain stays on audited place', Boolean(bp?.local.chain.some((node) => node.label.includes('대구'))));
	assert('local chain does not invent landmarks', bp?.local.chain.every((node) => !/동대구역|수성못|신세계/.test(node.label)) === true);
	assert('schema json-ld parses', Boolean(bp && JSON.parse(bp.schema.jsonLdText)['@type']));
	assert('MedicalBusiness is not forced', bp?.schema.candidates.find((item) => item.type === 'MedicalBusiness')?.status === 'skip');
	assert('copy units cover title/meta/h1/faq/answer/entity/schema', (bp?.copyUnits.length ?? 0) === 7);
	assert('blueprint has AI citation modules', Boolean(bp?.ragChunks.length && bp.decisionMatrix.rows.length && bp.informationGain.items.length && bp.safetySignals.notRecommended.length && bp.llmsTxt.markdown.includes('예제클리닉')));
	assert('흉터 matrix maps clinical types', /롤링|박스카|아이스픽/.test(JSON.stringify(problem?.blueprint.decisionMatrix.rows)));
	assert('리프팅 matrix maps HIFU/RF', /HIFU|RF|쥬베룩/.test(JSON.stringify(lifting?.blueprint.decisionMatrix.rows)));
	assert('action has p0 p1 p2', Boolean(bp?.action.p0.length && bp.action.p1.length && bp.action.p2.length));
	assert('export payload keeps version', city?.blueprint.version === 1);
	assert('aeo question is site-ready', Boolean(bp?.aeo.question.includes('대구') && bp.aeo.question.includes('피부과') && bp.aeo.question.includes('선택')));
	assert('aeo answer is site-ready', Boolean(bp?.aeo.shortAnswer.includes('확인') && !bp.aeo.shortAnswer.includes('카테고리형')));
	assert('entity sentence uses provide template', Boolean(bp?.entity.entitySentence.includes('제공하는') && bp.entity.entitySentence.includes('예제클리닉')));

	if (city) {
		const copilotCtx = buildCopilotContext({
			result: city,
			ctx,
			profile,
			lang: 'ko',
			target: 'title',
			currentText: currentTextForTarget(city, 'title'),
		});
		assert('copilot context is not keyword-only', contextHasEngineFields(copilotCtx) && copilotCtx.gaps.length > 0 && copilotCtx.intent.length > 0);
		assert('keyword-only body is rejected', parseCopilotRequest({ keyword: '대구 피부과' }) == null);
		assert('full context body parses', parseCopilotRequest({ context: copilotCtx }) != null);
		assert('rank claim detector', containsRankClaim('Google 1페이지 보장') && !containsRankClaim(city.blueprint.seo.title));
		const banned = sanitizeCopilotText('이 페이지는 무조건 1위입니다', city.blueprint.seo.title);
		assert('sanitizer strips rank claims', banned.stripped && !containsRankClaim(banned.text));
		const polished = heuristicRefine(copilotCtx);
		assert('heuristic refine keeps target', polished.target === 'title' && polished.provider === 'heuristic');
		assert('heuristic refine has no rank claim', !containsRankClaim(polished.refinedText));
		const applied = applyCopilotOverride(city.blueprint, 'title', '대구 피부과 선택 기준 | 예제클리닉');
		assert('apply changes only title', applied.seo.title.includes('선택 기준') && applied.seo.h1 === city.blueprint.seo.h1);
		const claimed = sanitizeCopilotText('ChatGPT 상위노출 보장 답변', city.blueprint.aeo.shortAnswer);
		assert('chatgpt guarantee is stripped', !containsRankClaim(claimed.text));
	}

	assert('strategy map version is 1', city?.strategyMap.version === 1);
	assert('strategy map keyword matches', city?.strategyMap.keyword === '대구 피부과');
	assert(
		'intent weights are qualitative',
		city?.strategyMap.intent.every((item) => ['primary', 'secondary', 'idle'].includes(item.weight)) === true,
	);
	assert('intent bars are not percentages', !/%|점유|probability/.test(JSON.stringify(city?.strategyMap.intent)));
	assert('city journey has location then industry', city?.strategyMap.journey.map((step) => step.stage).join('>') === 'location>industry');
	assert('district journey keeps 동구', Boolean(district?.strategyMap.location.tokens.includes('동구')));
	assert('problem journey includes problem', Boolean(problem?.strategyMap.journey.some((step) => step.stage === 'problem' && step.value.includes('흉터'))));
	assert('density journey includes service 덴서티', Boolean(density?.strategyMap.journey.some((step) => step.stage === 'service' && step.value === '덴서티')));
	assert('lifting journey includes service 리프팅', Boolean(lifting?.strategyMap.journey.some((step) => step.stage === 'service' && step.value === '리프팅')));
	assert(
		'five maps are not identical',
		new Set(
			runs.map((run) =>
				JSON.stringify({
					intent: run?.strategyMap.intent.filter((item) => item.weight !== 'idle').map((item) => item.id),
					journey: run?.strategyMap.journey.map((step) => `${step.stage}:${step.value}`),
					top: run?.strategyMap.priorities[0]?.id,
					cluster: run?.strategyMap.contentCluster.children.map((child) => child.label),
				}),
			),
		).size === 5,
	);
	assert('no invented competitors', city?.strategyMap.competition.ready === false && city.strategyMap.competition.names.length === 0);
	assert('competition note is pending', Boolean(city?.strategyMap.competition.note.includes('준비')));
	assert('cluster hub is existing audited url', city?.strategyMap.contentCluster.kind === 'existing' && city.strategyMap.contentCluster.url === 'https://clinic.example/');
	assert('condition cluster is new when missing', problem?.strategyMap.contentCluster.children.some((child) => child.role === 'condition' && child.kind === 'new') === true);
	assert('service cluster names leftover token', density?.strategyMap.contentCluster.children.some((child) => child.label === '덴서티') === true);
	assert('entity tree starts at brand', city?.strategyMap.entityTree.id === 'brand');
	assert('missing entity has why/what', Boolean(density?.strategyMap.entityStatus.find((item) => item.id === 'service')?.whyNeeded && density.strategyMap.entityStatus.find((item) => item.id === 'service')?.whatToAdd));
	assert('coverage has no invented aeo score', city?.strategyMap.coverage.find((row) => row.code === 'AEO')?.currentValue == null);
	assert('target is strategic not engine score', city?.strategyMap.coverage.every((row) => row.targetLabel === 'STRATEGIC TARGET') === true);
	assert('priorities include why first', Boolean(city?.strategyMap.priorities[0]?.whyFirst && city.strategyMap.priorities[0].why && city.strategyMap.priorities[0].what));
	assert('confidence is not fabricated market data', Boolean(city?.strategyMap.confidence.reasons.some((reason) => /Audit|Industry/.test(reason))));
	assert('portfolio is single-keyword ready', city?.strategyMap.portfolio.slots.length === 1 && city.strategyMap.portfolio.activeKeyword === '대구 피부과');
	assert('summary answers what to do', Boolean(city?.strategyMap.summary.topAction && city.strategyMap.summary.topGap));
	assert('surfaces carry model note', Boolean(city?.strategyMap.searchSurfaces[0]?.modelNote.includes('REDUE')));
}

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nstrategy audit-context assertions passed');
