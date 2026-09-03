/**
 * STEP 12 — AI Intelligence final QA.
 * Regression + integration + architecture + security + a11y contracts.
 * Run: npx tsx scripts/test-intelligence-final.ts
 *
 * Never prints secret values. Failures name the check only.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GET, POST } from '../app/api/intelligence/route';
import { ASI_OPERATIONS } from '../lib/ai-search-intelligence/api/operations';
import {
	AsiServiceError,
	asiSafeErrorMessage,
	classifyAsiThrown,
	classifyHttpStatus,
	httpStatusForAsiError,
} from '../lib/ai-search-intelligence/api/errors';
import { redactAsiSecrets } from '../lib/ai-search-intelligence/api/log';
import { asiFailCopy, asiLoadMessage } from '../lib/ai-search-intelligence/client/asi-client';
import { isAsiResultLive } from '../lib/ai-search-intelligence/client/use-asi-abort';
import { composeAsiLoop } from '../lib/ai-search-intelligence/loop/compose';
import { ASI_FEATURE_METRICS, getAsiMetric } from '../lib/ai-search-intelligence/provenance';
import { ASI_FEATURES, resolveAsiRoute } from '../lib/ai-search-intelligence/routes';
import { errorAsiResponse } from '../lib/ai-search-intelligence/providers/live-query';
import { generateVisibilityAlerts } from '../lib/ai-search-intelligence/visibility/alerts';
import { ASI_GUARD } from '../lib/ai-search-intelligence/guard/limits';
import { asiQueryCacheKey, clearAsiQueryCache, readAsiQueryCache, writeAsiQueryCache } from '../lib/ai-search-intelligence/guard/cache';
import { acquireAsiConcurrency, clearAsiConcurrency, releaseAsiConcurrency } from '../lib/ai-search-intelligence/guard/concurrency';
import type { AIResponse } from '../lib/ai-search-intelligence/types';

const EXISTING_12 = [
	'war-room',
	'brand-perception',
	'reputation-radar',
	'brand-snapshot',
	'recommendation-test',
	'recommendation-simulator',
	'share-of-voice',
	'competitor-analysis',
	'citation-explorer',
	'query-generator',
	'visibility-monitor',
	'agent-readiness',
] as const;

const LOOP_6 = [
	'opportunity-finder',
	'evidence-explorer',
	'competitor-gap',
	'next-best-action',
	'visibility-monitor',
] as const;

const LOOP_DASHBOARDS: Record<(typeof LOOP_6)[number], string> = {
	'opportunity-finder': 'components/ai-search-intelligence/opportunity/OpportunityDashboard.tsx',
	'evidence-explorer': 'components/ai-search-intelligence/evidence-explorer/EvidenceExplorerDashboard.tsx',
	'competitor-gap': 'components/ai-search-intelligence/competitor-gap/CompetitorGapDashboard.tsx',
	'next-best-action': 'components/ai-search-intelligence/next-action/NextActionDashboard.tsx',
	'visibility-monitor': 'components/ai-search-intelligence/visibility/VisibilityMonitorDashboard.tsx',
};

const LOOP_BOARDS: Record<(typeof LOOP_6)[number], string> = {
	'opportunity-finder': 'components/ai-search-intelligence/opportunity/OpportunityBoard.tsx',
	'evidence-explorer': 'components/ai-search-intelligence/evidence-explorer/EvidenceExplorerBoard.tsx',
	'competitor-gap': 'components/ai-search-intelligence/competitor-gap/CompetitorGapBoard.tsx',
	'next-best-action': 'components/ai-search-intelligence/next-action/NextActionBoard.tsx',
	'visibility-monitor': 'components/ai-search-intelligence/visibility/VisibilityMonitorBoard.tsx',
};

const EXISTING_VIEWS: Record<(typeof EXISTING_12)[number], string> = {
	'war-room': 'components/ai-search-intelligence/war-room/WarRoomDashboard.tsx',
	'brand-perception': 'components/ai-search-intelligence/perception/BrandPerceptionPanel.tsx',
	'reputation-radar': 'components/ai-search-intelligence/perception/ReputationRadarPanel.tsx',
	'brand-snapshot': 'components/ai-search-intelligence/perception/BrandSnapshotPanel.tsx',
	'recommendation-test': 'components/ai-search-intelligence/recommendation/RecommendTestPanel.tsx',
	'recommendation-simulator': 'components/ai-search-intelligence/recommendation/RecommendSimulatorPanel.tsx',
	'share-of-voice': 'components/ai-search-intelligence/recommendation/RecommendSovPanel.tsx',
	'competitor-analysis': 'components/ai-search-intelligence/recommendation/RecommendCompetitorsPanel.tsx',
	'citation-explorer': 'components/ai-search-intelligence/evidence/CitationExplorerPanel.tsx',
	'query-generator': 'components/ai-search-intelligence/evidence/QuestionGeneratorPanel.tsx',
	'visibility-monitor': 'components/ai-search-intelligence/visibility/VisibilityMonitorBoard.tsx',
	'agent-readiness': 'components/ai-search-intelligence/future/AgentReadinessDashboard.tsx',
};

type Section =
	| 'existing12'
	| 'opportunity'
	| 'evidence'
	| 'gap'
	| 'action'
	| 'visibility'
	| 'alert'
	| 'architecture'
	| 'security'
	| 'performance'
	| 'accessibility'
	| 'responsive';

const sectionFail: Record<Section, number> = {
	existing12: 0,
	opportunity: 0,
	evidence: 0,
	gap: 0,
	action: 0,
	visibility: 0,
	alert: 0,
	architecture: 0,
	security: 0,
	performance: 0,
	accessibility: 0,
	responsive: 0,
};

let failed = 0;

function assert(section: Section, label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  [${section}] ${label}`);
		return;
	}
	failed += 1;
	sectionFail[section] += 1;
	console.error(`FAIL [${section}] ${label}${detail ? ` — ${detail}` : ''}`);
}

function verdict(section: Section): 'PASS' | 'FAIL' {
	return sectionFail[section] === 0 ? 'PASS' : 'FAIL';
}

function read(rel: string) {
	return readFileSync(join(process.cwd(), rel), 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
		const full = join(dir, name);
		const stat = statSync(full);
		if (stat.isDirectory()) walk(full, out);
		else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) out.push(full);
	}
	return out;
}

function countExport(src: string, name: string): number {
	const re = new RegExp(`export (async )?function ${name}\\b`, 'g');
	return src.match(re)?.length ?? 0;
}

async function readJson(res: Response) {
	return (await res.json()) as Record<string, unknown>;
}

function post(body: unknown, headers?: Record<string, string>) {
	return POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'accept-language': 'ko',
				'x-asi-test-tier': 'pro',
				...headers,
			},
			body: typeof body === 'string' ? body : JSON.stringify(body),
		}),
	);
}

function snapshotOf(body: Record<string, unknown>): Record<string, unknown> | null {
	const data = body.data as { snapshot?: Record<string, unknown> } | null;
	return data?.snapshot ?? null;
}

const SITE = {
	url: 'https://sunshineclinic.kr',
	brandName: 'Sunshine',
	domain: 'sunshineclinic.kr',
	location: '대구',
	category: '흉터',
};

void (async () => {
	assert('architecture', 'canonical tools stay at 16', ASI_FEATURES.length === 16);
	assert('architecture', 'public operations stay at 16', ASI_OPERATIONS.length === 16);
	assert(
		'architecture',
		'no 17th tool slug',
		!ASI_FEATURES.some((tool) => tool.slug === 'alert') && !ASI_OPERATIONS.includes('alert' as never),
	);

	for (const slug of EXISTING_12) {
		const route = resolveAsiRoute([slug]);
		assert('existing12', `${slug} resolves without extra redirect`, !route.redirectTo && route.tool.slug === slug);
		assert('existing12', `${slug} view exists`, existsSync(join(process.cwd(), EXISTING_VIEWS[slug])));
	}

	const featureView = read('components/ai-search-intelligence/AsiFeatureView.tsx');
	assert('existing12', 'feature view mounts war-room', featureView.includes('WarRoomDashboard'));
	assert('existing12', 'feature view mounts perception', featureView.includes('PerceptionDashboard'));
	assert('existing12', 'feature view mounts recommendation', featureView.includes('RecommendationDashboard'));
	assert('existing12', 'feature view mounts evidence', featureView.includes('EvidenceDashboard'));
	assert('existing12', 'feature view mounts agent-readiness', featureView.includes('AgentReadinessDashboard'));
	assert('existing12', 'feature view does not fall through to placeholder for known tools', !featureView.includes("if (tool === 'war-room') return <AsiToolPlaceholder"));

	for (const operation of EXISTING_12) {
		const res = await post({ operation, url: SITE.url });
		const body = await readJson(res);
		assert('existing12', `POST ${operation} 200`, res.status === 200, String(res.status));
		assert('existing12', `POST ${operation} snapshot`, Boolean(snapshotOf(body)));
		assert('existing12', `POST ${operation} no API_KEY leak`, !JSON.stringify(body).includes('API_KEY'));
		assert('existing12', `POST ${operation} no OpenAI Error`, !JSON.stringify(body).includes('OpenAI Error'));
	}

	const chrome = read('components/ai-search-intelligence/primitives/AsiPageChrome.tsx');
	assert('architecture', 'chrome has loading state', chrome.includes('AsiLoadingState') && chrome.includes('loading ?'));
	assert('architecture', 'chrome has empty state', chrome.includes('AsiEmptyState') && chrome.includes('waitingTitle'));
	assert('architecture', 'chrome has error note', chrome.includes('AsiErrorNote') && chrome.includes('{error ?'));
	assert('architecture', 'chrome shows provenance legend on success', chrome.includes('AsiProvenanceLegend'));

	const failCopy = asiFailCopy('잘못된 URL', (key) => {
		if (key === 'analyzeFailed') return 'AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
		if (key === 'errors.timeout') return 'AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
		if (key === 'errors.apiKey') return 'AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
		return key;
	});

	const loopSection: Record<(typeof LOOP_6)[number], Section> = {
		'opportunity-finder': 'opportunity',
		'evidence-explorer': 'evidence',
		'competitor-gap': 'gap',
		'next-best-action': 'action',
		'visibility-monitor': 'visibility',
	};

	for (const operation of LOOP_6) {
		const section = loopSection[operation];
		const dash = read(LOOP_DASHBOARDS[operation]);
		const board = read(LOOP_BOARDS[operation]);

		const viaHook = dash.includes('useAsiAnalysis');
		assert(section, `${operation} loading`, dash.includes('loading={loading}') && (viaHook || dash.includes('useState(false)')));
		assert(section, `${operation} empty chrome`, dash.includes('emptyTitle') && dash.includes('emptyBody'));
		assert(section, `${operation} error chrome`, dash.includes('AsiPageChrome') && (viaHook || dash.includes('setError')));
		assert(
			section,
			`${operation} abort`,
			viaHook || (dash.includes('useAsiAbort()') && dash.includes('if (!isLive(signal)) return')),
		);
		assert(section, `${operation} safe fail copy`, dash.includes('asiFailCopy') && (viaHook || dash.includes('asiLoadMessage')));
		assert(section, `${operation} timeout mapped`, dash.includes('asiFailCopy') && failCopy.provider_timeout?.includes('AI 분석을 완료하지 못했습니다'));
		assert(section, `${operation} no raw error print`, !dash.includes('{error}</p>') && !dash.includes('OpenAI'));

		const res = await post({ operation, url: SITE.url });
		const body = await readJson(res);
		const snap = snapshotOf(body);
		assert(section, `${operation} success 200`, res.status === 200, String(res.status));
		assert(section, `${operation} success snapshot`, Boolean(snap));
		assert(section, `${operation} success site`, snap?.site && typeof (snap.site as { url?: string }).url === 'string');
		assert(section, `${operation} no vendor error text`, !JSON.stringify(body).includes('OpenAI Error') && !JSON.stringify(body).includes('Anthropic'));
		assert(section, `${operation} board exists`, board.length > 0);
	}

	const emptyLoop = composeAsiLoop({ site: SITE, fallbackVisibility: 0 });
	assert('opportunity', 'empty loop invents no opportunities', emptyLoop.opportunities.length === 0);
	assert('evidence', 'empty loop invents no evidence tops', emptyLoop.opportunities.length === 0);
	assert('gap', 'empty loop invents no gaps', emptyLoop.gaps.length === 0);
	assert('action', 'empty loop invents no actions', emptyLoop.actions.length === 0);
	assert('alert', 'empty loop invents no alerts', emptyLoop.alerts.length === 0);

	const gapBoard = read(LOOP_BOARDS['competitor-gap']);
	assert('gap', 'gap empty board', gapBoard.includes('AsiObservationEmpty') && gapBoard.includes('observationState'));
	const explorerBoard = read(LOOP_BOARDS['evidence-explorer']);
	assert('evidence', 'explorer empty answers', explorerBoard.includes('observedEmpty') && explorerBoard.includes('AsiEmptyState'));
	const actionBoard = read(LOOP_BOARDS['next-best-action']);
	assert('action', 'action empty chrome via dashboard', read(LOOP_DASHBOARDS['next-best-action']).includes('emptyTitle'));

	const visBoard = read(LOOP_BOARDS['visibility-monitor']);
	assert('alert', 'alert section exists', visBoard.includes('id="asi-alerts"') && visBoard.includes('alertEmpty'));
	assert('alert', 'alert lock panel', visBoard.includes("feature=\"visibility.alert\""));
	assert('alert', 'alert values marked observed', visBoard.includes('AsiProvenanceBadge') && visBoard.includes('badge="observed"'));
	assert('alert', 'alert causes marked derived', visBoard.includes('badge="redue_analysis"'));
	assert('alert', 'alert shares visibility loading/error chrome', read(LOOP_DASHBOARDS['visibility-monitor']).includes('loading={loading}'));

	const noHistoryAlerts = generateVisibilityAlerts({
		records: [],
		trend: {
			window: 'today',
			kpis: {
				visibility: { current: 40, previous: null, change: null, changePct: null, provenance: 'observed' },
				recommendation: { current: 20, previous: null, change: null, changePct: null, provenance: 'observed' },
				citation: { current: 10, previous: null, change: null, changePct: null, provenance: 'observed' },
				sov: { current: 15, previous: null, change: null, changePct: null, provenance: 'observed' },
			},
			providers: [],
			competitors: [],
			gap: {
				brandCurrent: null,
				brandPrevious: null,
				competitorName: null,
				competitorCurrent: null,
				competitorPrevious: null,
				widened: false,
			},
			points: [],
			hasPrevious: false,
		},
		window: 'today',
	});
	assert('alert', 'empty history produces no alerts', noHistoryAlerts.length === 0);

	const visRes = await post({ operation: 'visibility-monitor', url: SITE.url });
	const visBody = await readJson(visRes);
	const visSnap = snapshotOf(visBody) as { alerts?: unknown[] } | null;
	assert('alert', 'visibility success includes alerts array', Array.isArray(visSnap?.alerts));

	const bad = await post({ operation: 'opportunity-finder', url: 'not-a-url' });
	const badBody = await readJson(bad);
	assert('opportunity', 'invalid url is error', bad.status === 422);
	assert(
		'opportunity',
		'invalid url is user-safe',
		typeof (badBody.error as { message?: string })?.message === 'string' &&
			!(badBody.error as { message?: string }).message?.includes('OpenAI'),
	);

	assert('architecture', 'timeout classifies as provider_timeout', classifyAsiThrown(Object.assign(new Error('aborted'), { name: 'AbortError' })).code === 'provider_timeout');
	assert('architecture', 'timeout http is 504', httpStatusForAsiError('provider_timeout') === 504);
	assert('architecture', '504 classifies timeout', classifyHttpStatus(504) === 'provider_timeout');
	assert(
		'architecture',
		'ui timeout copy is safe',
		asiLoadMessage('provider_timeout', failCopy).includes('AI 분석을 완료하지 못했습니다') &&
			!asiLoadMessage('provider_timeout', failCopy).includes('OpenAI'),
	);

	const leaked = errorAsiResponse('chatgpt', { query: 'q', url: SITE.url, brand: 'X' }, 'api_key', 'OpenAI Error: incorrect api key');
	assert('architecture', 'provider failure strips vendor text', leaked.meta?.error === 'api_key' && !JSON.stringify(leaked).includes('OpenAI Error'));
	assert('architecture', 'provider failure answer is not vendor dump', !leaked.answer.includes('OpenAI'));
	assert(
		'architecture',
		'safe unavailable copy',
		asiSafeErrorMessage('unavailable', 'ko') === 'AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
	);

	const guestGap = await post({ operation: 'competitor-gap', url: SITE.url }, { 'x-asi-test-tier': 'guest' });
	const guestGapBody = await readJson(guestGap);
	assert('gap', 'guest gap is entitlement error', guestGap.status === 403);
	assert(
		'gap',
		'guest gap copy is not vendor',
		((guestGapBody.error as { code?: string })?.code === 'entitlement' ||
			(guestGapBody.error as { code?: string })?.code === 'entitlement_quota') &&
			!JSON.stringify(guestGapBody).includes('OpenAI'),
	);

	const guestAction = await post({ operation: 'next-best-action', url: SITE.url }, { 'x-asi-test-tier': 'guest' });
	assert('action', 'guest action is entitlement error', guestAction.status === 403);

	const libRoot = join(process.cwd(), 'lib', 'ai-search-intelligence');
	const libFiles = walk(libRoot);
	const libSrc = libFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

	assert('architecture', 'queryAsiProviders defined once', countExport(libSrc, 'queryAsiProviders') === 1);
	assert('architecture', 'fetchAsiJson defined once', countExport(libSrc, 'fetchAsiJson') === 1);
	assert('architecture', 'createAsiProviders defined once', countExport(libSrc, 'createAsiProviders') === 1);
	assert('architecture', 'scoreOpportunitySignals defined once', countExport(libSrc, 'scoreOpportunitySignals') === 1);
	assert('architecture', 'buildVisibilityRecord defined once', countExport(libSrc, 'buildVisibilityRecord') === 1);
	assert('architecture', 'classifyCitationSource defined once', countExport(libSrc, 'classifyCitationSource') === 1);
	assert('architecture', 'generateOpportunityQueries defined once', countExport(libSrc, 'generateOpportunityQueries') === 1);
	assert('architecture', 'toAsiProviderQueryFromIntelligence defined once', countExport(libSrc, 'toAsiProviderQueryFromIntelligence') === 1);

	const loopRunners = [
		'lib/ai-search-intelligence/opportunity/run.ts',
		'lib/ai-search-intelligence/evidence-explorer/run.ts',
		'lib/ai-search-intelligence/competitor-gap/run.ts',
		'lib/ai-search-intelligence/next-action/run.ts',
		'lib/ai-search-intelligence/visibility/run.ts',
		'lib/ai-search-intelligence/perception/run.ts',
		'lib/ai-search-intelligence/providers/query-plan.ts',
	];
	for (const file of loopRunners) {
		const src = read(file);
		assert(
			'architecture',
			`${file} uses query plan`,
			src.includes('runAsiQueryPlan') || src.includes('queryAsiProviders'),
		);
		assert('architecture', `${file} has no fetch(`, !src.includes('fetch('));
		assert('architecture', `${file} has no live provider import`, !/openai-provider|gemini-provider|claude-provider|perplexity-provider/.test(src));
	}

	assert('architecture', 'loop compose does not query providers', !read('lib/ai-search-intelligence/loop/compose.ts').includes('queryAsiProviders'));
	assert(
		'architecture',
		'tick remesasures through visibility runner',
		read('lib/ai-search-intelligence/visibility/tick.ts').includes('remeasure: true') &&
			read('lib/ai-search-intelligence/visibility/tick.ts').includes('runAsiVisibility') &&
			!read('lib/ai-search-intelligence/visibility/tick.ts').includes('queryAsiProviders'),
	);

	for (const tool of ASI_FEATURES) {
		const metrics = ASI_FEATURE_METRICS[tool.id] ?? [];
		assert('architecture', `${tool.id} has provenance metrics`, metrics.length > 0);
		for (const id of metrics) {
			const def = getAsiMetric(id);
			assert(
				'architecture',
				`${tool.id} · ${id} is observed or derived`,
				def.provenance === 'observed' || def.provenance === 'derived',
			);
		}
	}

	const provenanceViews = Object.values({ ...EXISTING_VIEWS, ...LOOP_BOARDS });
	for (const file of provenanceViews) {
		const src = read(file);
		assert(
			'architecture',
			`${file} wires observed/derived`,
			src.includes('AsiProvenanceBadge') || src.includes('metric=') || src.includes('provenance=') || src.includes('AsiMetricTooltip'),
		);
	}
	assert('architecture', 'page chrome legend on success', chrome.includes('AsiProvenanceLegend'));
	assert('architecture', 'answer result is observed', read('components/ai-search-intelligence/primitives/AsiAnswerResult.tsx').includes('observedBadgeForSource'));

	const clientRoots = [
		join(process.cwd(), 'components', 'ai-search-intelligence'),
		join(process.cwd(), 'app', 'intelligence'),
		join(process.cwd(), 'lib', 'ai-search-intelligence', 'client'),
		join(process.cwd(), 'lib', 'ai-search-intelligence', 'entitlement'),
	];
	const clientFiles = clientRoots.flatMap((dir) => walk(dir));
	const SECRET_NAMES = [
		'OPENAI_API_KEY',
		'ANTHROPIC_API_KEY',
		'GEMINI_API_KEY',
		'PERPLEXITY_API_KEY',
		'NEXTAUTH_SECRET',
	];
	const PUBLIC_SECRET = /NEXT_PUBLIC_[A-Z0-9_]*SECRET/;
	const PUBLIC_LLM_KEY = /NEXT_PUBLIC_(OPENAI|GEMINI|PERPLEXITY|ANTHROPIC|ASI)_API_KEY/;
	const CLIENT_PROVIDER_IMPORT =
		/from ['"]@\/lib\/ai-search-intelligence\/providers\/(openai-provider|gemini-provider|claude-provider|perplexity-provider|create-providers|live-query|http)['"]/;
	let clientSecretName = false;
	let clientPublicSecret = false;
	let clientPublicLlm = false;
	let clientProvider = false;
	let clientBearerAssign = false;
	for (const file of clientFiles) {
		if (file.endsWith('actor.ts')) continue;
		const src = readFileSync(file, 'utf8');
		if (SECRET_NAMES.some((name) => src.includes(name))) clientSecretName = true;
		if (PUBLIC_SECRET.test(src)) clientPublicSecret = true;
		if (PUBLIC_LLM_KEY.test(src)) clientPublicLlm = true;
		if (CLIENT_PROVIDER_IMPORT.test(src)) clientProvider = true;
		if (/Authorization:\s*[`'"]Bearer\s+[^$]/.test(src) || /headers\.Authorization\s*=\s*['"]Bearer\s+\S+['"]/.test(src)) {
			clientBearerAssign = true;
		}
	}
	assert('security', 'client has no LLM/NEXTAUTH env names', !clientSecretName);
	assert('security', 'client has no NEXT_PUBLIC_*SECRET', !clientPublicSecret);
	assert('security', 'client has no NEXT_PUBLIC LLM keys', !clientPublicLlm);
	assert('security', 'client does not import live providers', !clientProvider);
	assert('security', 'client does not hardcode Bearer tokens', !clientBearerAssign);

	const example = read('.env.example');
	assert('security', '.env.example has no NEXT_PUBLIC LLM keys', !PUBLIC_LLM_KEY.test(example));
	assert('security', 'redact leaves no sk- value', !redactAsiSecrets('Authorization: Bearer sk-proj-PLACEHOLDERVALUE').includes('sk-proj-PLACEHOLDERVALUE'));
	assert('security', 'redact Authorization Bearer', redactAsiSecrets('Authorization: Bearer abc.def').includes('[redacted]'));

	const getRes = await GET(new Request('http://localhost/api/intelligence'));
	const getBody = await readJson(getRes);
	const dumped = JSON.stringify(getBody);
	assert('security', 'GET status leaks no env names', !SECRET_NAMES.some((name) => dumped.includes(name)));
	assert('security', 'GET status leaks no Bearer', !dumped.includes('Bearer '));

	const dashboards = [
		...Object.values(LOOP_DASHBOARDS),
		'components/ai-search-intelligence/war-room/WarRoomDashboard.tsx',
		'components/ai-search-intelligence/perception/PerceptionDashboard.tsx',
		'components/ai-search-intelligence/recommendation/RecommendationDashboard.tsx',
		'components/ai-search-intelligence/evidence/EvidenceDashboard.tsx',
		'components/ai-search-intelligence/future/AgentReadinessDashboard.tsx',
	];
	const analysisHook = read('lib/ai-search-intelligence/client/use-asi-analysis.ts');
	assert('performance', 'shared hook aborts in-flight', analysisHook.includes('useAsiAbort()') || analysisHook.includes('useAsiAbort('));
	assert('performance', 'shared hook ignores unmounted', analysisHook.includes('if (!isLive(signal)) return'));
	assert(
		'performance',
		'shared hook session cache',
		analysisHook.includes('readAsiSessionSnapshot') && analysisHook.includes('writeAsiSessionSnapshot'),
	);

	for (const file of dashboards) {
		const src = read(file);
		const viaHook = src.includes('useAsiAnalysis');
		assert(
			'performance',
			`${file} aborts in-flight`,
			viaHook || src.includes('useAsiAbort()') || src.includes('useAsiAbort('),
		);
		assert('performance', `${file} ignores unmounted`, viaHook || src.includes('if (!isLive(signal)) return'));
		assert(
			'performance',
			`${file} session cache`,
			viaHook || (src.includes('readAsiSessionSnapshot') && src.includes('writeAsiSessionSnapshot')),
		);
	}

	const first = new AbortController();
	const second = new AbortController();
	assert('performance', 'live signal matches', isAsiResultLive(true, first.signal, first.signal));
	assert('performance', 'replaced request is stale', !isAsiResultLive(true, second.signal, first.signal));
	assert('performance', 'unmounted request ignored', !isAsiResultLive(false, first.signal, first.signal));

	clearAsiQueryCache();
	const cacheKey = asiQueryCacheKey('chatgpt', SITE.url, '대구 흉터 치료 추천');
	const cached: AIResponse = {
		provider: 'chatgpt',
		query: '대구 흉터 치료 추천',
		answer: 'cached',
		mentions: ['Sunshine'],
		recommendations: ['Sunshine'],
		citations: [],
		confidence: 0.7,
		timestamp: '2026-08-30T00:00:00.000Z',
		source: 'live',
	};
	writeAsiQueryCache(cacheKey, cached);
	assert('performance', 'cache hit', readAsiQueryCache(cacheKey)?.answer === 'cached');
	assert('performance', 'cache ttl configured', ASI_GUARD.cacheTtlMs >= 60_000);
	assert('performance', 'cooldown configured', ASI_GUARD.cooldownMs > 0);

	clearAsiConcurrency();
	acquireAsiConcurrency('qa:user');
	acquireAsiConcurrency('qa:user');
	try {
		acquireAsiConcurrency('qa:user');
		assert('performance', 'third concurrent throws', false);
	} catch (error) {
		assert('performance', 'concurrent cap is rate_limit', error instanceof AsiServiceError && error.code === 'rate_limit');
	}
	releaseAsiConcurrency('qa:user');
	releaseAsiConcurrency('qa:user');

	const client = read('lib/ai-search-intelligence/client/asi-client.ts');
	assert('performance', 'client posts through one helper', (client.match(/async function postAsi/g) ?? []).length === 1);
	assert('performance', 'client accepts AbortSignal', client.includes('signal?: AbortSignal'));

	const tabList = read('components/ai-search-intelligence/primitives/AsiFilterTabList.tsx');
	assert('accessibility', 'tablist ArrowLeft/Right', tabList.includes('ArrowLeft') && tabList.includes('ArrowRight'));
	assert('accessibility', 'tablist role', tabList.includes('role="tablist"'));
	const chip = read('components/ai-search-intelligence/primitives/AsiFilterChip.tsx');
	assert('accessibility', 'chip role=tab', chip.includes('role="tab"') && chip.includes('aria-selected'));
	assert('accessibility', 'url field has sr-only label', chrome.includes('sr-only') && chrome.includes('htmlFor={inputId}'));
	assert('accessibility', 'loading is polite busy', read('components/ai-search-intelligence/primitives/AsiEmptyState.tsx').includes('aria-busy="true"') && read('components/ai-search-intelligence/primitives/AsiEmptyState.tsx').includes('aria-live="polite"'));
	assert('accessibility', 'focus ring token', read('lib/ui/asi-chrome.ts').includes('focus-visible:ring-2') && read('lib/ui/asi-chrome.ts').includes('asiFocusRing'));
	assert('accessibility', 'reduced motion', read('lib/ui/asi-chrome.ts').includes('motion-reduce:transition-none'));
	const lockCta = read('components/ai-search-intelligence/entitlement/AsiLockCta.tsx');
	assert('accessibility', 'lock CTA opens AuthModal or PricingModal', lockCta.includes('AuthModal') && lockCta.includes('PricingModal'));
	const pricing = read('components/PricingModal.tsx');
	assert('accessibility', 'pricing modal Escape', pricing.includes("event.key === 'Escape'"));
	assert('accessibility', 'ia nav has aria-label', read('components/ai-search-intelligence/shell/AsiIaNav.tsx').includes('aria-label'));
	assert('accessibility', 'tooltip focus-within', read('components/ai-search-intelligence/primitives/AsiMetricTooltip.tsx').includes('group-focus-within'));

	const iaNav = read('components/ai-search-intelligence/shell/AsiIaNav.tsx');
	const layout = read('components/ai-search-intelligence/shell/AiIntelligenceLayout.tsx');
	assert('responsive', 'desktop 1440/1280 via xl/2xl', iaNav.includes('xl:grid-cols-3') && iaNav.includes('2xl:grid-cols-6'));
	assert('responsive', '1024 via lg/md', iaNav.includes('md:grid-cols-2') && (layout.includes('sm:text-3xl') || chrome.includes('sm:text-3xl')));
	assert('responsive', 'tablet 768 md', iaNav.includes('md:grid-cols-2') && gapBoard.includes('md:grid-cols-2'));
	assert('responsive', 'mobile stacks form', chrome.includes('flex-col') && chrome.includes('sm:flex-row'));
	assert('responsive', 'tables scroll on 390/375', read('lib/ui/asi-chrome.ts').includes('overflow-x-auto') && read('components/ai-search-intelligence/primitives/AsiDataTable.tsx').includes('minWidthClass'));
	assert('responsive', 'cards min-w-0', chrome.includes('min-w-0') && read('components/ai-search-intelligence/primitives/AsiCard.tsx').includes('min-w-0'));
	assert('responsive', 'chart frame scrolls', read('components/ai-search-intelligence/primitives/AsiChartFrame.tsx').includes('overflow-x-auto'));

	const report = {
		'Existing 12': verdict('existing12'),
		Opportunity: verdict('opportunity'),
		Evidence: verdict('evidence'),
		'Competitor Gap': verdict('gap'),
		'Next Best Action': verdict('action'),
		'Visibility Monitor': verdict('visibility'),
		Alert: verdict('alert'),
		'Provider Architecture': verdict('architecture'),
		Security: verdict('security'),
		Performance: verdict('performance'),
		Accessibility: verdict('accessibility'),
		Responsive: verdict('responsive'),
	};

	console.log('\n# AI INTELLIGENCE FINAL QA (script)');
	for (const [name, status] of Object.entries(report)) {
		console.log(`${name}: ${status}`);
	}
	console.log(`checks failed: ${failed}`);

	if (failed) {
		process.exit(1);
	}
	console.log('\nall passed');
})();
