/**
 * Trigger Keyword Depth stays locked to engineScores + isHttps.
 * Run: npx tsx scripts/test-trigger-depth-engine.ts
 */
import { buildAiEngineVisibilityReport } from '../lib/audit/ai-engine-visibility';
import { buildDiagnosisScoreSnapshot } from '../lib/audit/diagnosis-scores';
import {
	HTTPS_ENGINE_SCORE_CAP,
	HTTPS_SECURITY_ALERT,
} from '../lib/audit/scoreCalculator';
import {
	HTTPS_SECURITY_TAGS,
	calculateTriggerDepths,
	resolveTriggerLevel,
} from '../lib/audit/triggerDepthEngine';
import { buildGeoDiagnosticReportFromAudit } from '../lib/geo/from-visibility';
import { asIsLevelFromEngineScore } from '../lib/geo/rating-meta';
import { getEngineKeyAction, getEngineKeyActions } from '../lib/geo/trigger-simulation';
import type { AuditCategory, AuditCheckItem, AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const scores = {
	chatgpt: { score: 88 },
	gemini: { score: 74 },
	perplexity: { score: 61 },
	claude: { score: 59 },
	copilot: { score: 80 },
	clova: { score: 40 },
};

const httpsDepths = calculateTriggerDepths('레드의원', '강남', '피부과', scores, true);
assert('HTTPS L3 at 88', httpsDepths.chatgpt.currentLevel === 3 && /피부과/.test(httpsDepths.chatgpt.currentQuery) && /어디가 좋아/.test(httpsDepths.chatgpt.currentQuery));
assert('HTTPS L2 at 74', httpsDepths.gemini.currentLevel === 2 && /피부과/.test(httpsDepths.gemini.currentQuery) && !httpsDepths.gemini.currentQuery.includes('레드의원'));
assert('HTTPS L2 at 61', httpsDepths.perplexity.currentLevel === 2);
assert('HTTPS L1 at 59', httpsDepths.claude.currentLevel === 1 && httpsDepths.claude.currentQuery === '레드의원');
assert('HTTPS L3 at 80', httpsDepths.copilot.currentLevel === 3);
assert('HTTPS L1 at 40', httpsDepths.clova.currentLevel === 1);
assert('To-Be is always Level 3', Object.values(httpsDepths).every((sim) => sim.targetLevel === 3 && /피부과/.test(sim.targetQuery) && /추천/.test(sim.targetQuery)));
assert('HTTPS tags stay off when secure', httpsDepths.chatgpt.tags[0] !== HTTPS_SECURITY_TAGS[0] && !httpsDepths.chatgpt.isLockedBySecurity);

const httpDepths = calculateTriggerDepths('레드의원', '강남', '피부과', scores, false);
assert(
	'HTTP forces every engine to Level 1',
	Object.values(httpDepths).every((sim) => sim.currentLevel === 1 && sim.isLockedBySecurity && sim.currentQuery === '레드의원'),
);
assert(
	'HTTP injects security hashtags first',
	httpDepths.chatgpt.tags[0] === HTTPS_SECURITY_TAGS[0] &&
		httpDepths.chatgpt.tags[1] === HTTPS_SECURITY_TAGS[1] &&
		httpDepths.gemini.tags[0] === '#HTTPS보안미적용',
);
assert('HTTP still targets Level 3 after the 5 prescriptions', httpDepths.chatgpt.targetLevel === 3);

assert('resolveTriggerLevel HTTPS 80 → 3', resolveTriggerLevel(80, true) === 3);
assert('resolveTriggerLevel HTTPS 79 → 2', resolveTriggerLevel(79, true) === 2);
assert('resolveTriggerLevel HTTPS 60 → 2', resolveTriggerLevel(60, true) === 2);
assert('resolveTriggerLevel HTTPS 59 → 1', resolveTriggerLevel(59, true) === 1);
assert('resolveTriggerLevel HTTP 99 → 1', resolveTriggerLevel(99, false) === 1);
assert('asIsLevelFromEngineScore allows L3', asIsLevelFromEngineScore(88, { isHttps: true }) === 3);
assert('asIsLevelFromEngineScore locks HTTP', asIsLevelFromEngineScore(88, { isHttps: false }) === 1);
assert('asIsLevelFromEngineScore honesty cap', asIsLevelFromEngineScore(88, { brandOnly: true, isHttps: true }) === 1);

const numberMap = calculateTriggerDepths('브랜드', '서울', '법률', { chatgpt: 81, gemini: 64 }, true);
assert('number map is accepted', numberMap.chatgpt.currentLevel === 3 && numberMap.gemini.currentLevel === 2);

const clinicSignals = {
	domain: 'clinic.example.com',
	technicalPct: 82,
	schemaPct: 80,
	geoPct: 78,
	orgPresent: true,
	orgComplete: true,
	faqPresent: true,
	aiBotsOk: true,
	keywords: ['피부과', '강남'],
	schemaTypes: ['MedicalClinic'],
};

const visHttps = buildAiEngineVisibilityReport({
	url: 'https://clinic.example.com',
	lang: 'ko',
	measuredEngineScores: {
		chatgpt: 88,
		gemini: 74,
		claude: 50,
		perplexity: 81,
		copilot: 62,
		clova: 40,
	},
	isHttps: true,
	signals: clinicSignals,
	siteMeta: {
		url: 'https://clinic.example.com',
		domain: 'clinic.example.com',
		brandName: '레드의원',
		category: '피부과',
		primaryKeyword: '피부과',
		location: '강남',
		industryType: 'MEDICAL',
	} as never,
});
assert(
	'visibility HTTPS L3 is not capped',
	visHttps.engines.find((e) => e.engineId === 'chatgpt')?.triggerLevel === 3 &&
		visHttps.engines.find((e) => e.engineId === 'chatgpt')?.status === 'optimal',
);
assert('visibility HTTPS L2 stays L2', visHttps.engines.find((e) => e.engineId === 'gemini')?.triggerLevel === 2);
assert(
	'visibility HTTPS has no security hashtag',
	!visHttps.engines.some((e) => e.currentStatus?.statusTags.includes('#HTTPS보안미적용')),
);

const visHttp = buildAiEngineVisibilityReport({
	url: 'http://plain.example.com',
	lang: 'ko',
	measuredEngineScores: {
		chatgpt: 88,
		gemini: 74,
		claude: 50,
		perplexity: 81,
		copilot: 62,
		clova: 40,
	},
	isHttps: false,
	siteMeta: {
		url: 'http://plain.example.com',
		domain: 'plain.example.com',
		brandName: '레드의원',
		category: '피부과',
		primaryKeyword: '피부과',
		location: '강남',
		industryType: 'MEDICAL',
	} as never,
});
assert(
	'visibility HTTP locks every engine at Level 1',
	visHttp.engines.every((e) => e.triggerLevel <= 1 && e.currentStatus?.isLockedBySecurity === true),
);
assert(
	'visibility HTTP prepends security hashtags',
	visHttp.engines.every(
		(e) =>
			e.currentStatus?.statusTags[0] === '#HTTPS보안미적용' &&
			e.currentStatus?.statusTags[1] === '#비보안출처_추천제한',
	),
);
assert(
	'visibility To-Be stays Level 3',
	visHttp.engines.every((e) => e.postOptimization?.targetLevel === 3),
);

function check(id: string, status: AuditCheckItem['status'], weight: number): AuditCheckItem {
	return { id, label: id, status, passed: status === 'pass', weight };
}

function category(id: AuditCategory['id'], score: number, maxScore: number, checks: AuditCheckItem[]): AuditCategory {
	return { id, label: id, score, maxScore, status: 'PASS', statusNote: '', checks };
}

function report(url: string): AuditReport {
	return {
		url,
		lang: 'ko',
		fetchedAt: '2026-08-16T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 80,
		pageSizeBytes: 20_000,
		score: 122,
		maxScore: 122,
		status: 'EXCELLENT',
		statusLabel: '최적화 완료',
		categories: [
			category('seo', 29, 29, [check('title', 'pass', 5)]),
			category('performance', 15, 15, [check('response-time', 'pass', 6)]),
			category('schema', 37, 37, [check('jsonld-present', 'pass', 8)]),
			category('accessibility', 15, 15, [check('html-lang', 'pass', 5)]),
			category('geo', 26, 26, [check('faq-howto-schema', 'pass', 7)]),
		],
		checklist: [],
		findings: [],
	};
}

const httpLive = report('http://plain.example/');
const snapshot = buildDiagnosisScoreSnapshot(httpLive, null, 'ko');
const diagnostic = buildGeoDiagnosticReportFromAudit(httpLive, 'ko');
assert('snapshot isHttps is false', snapshot.isHttps === false);
assert(
	'diagnostic scores match snapshot.engineScores',
	diagnostic.engines.every((engine) => engine.score === snapshot.scores.engineScores[engine.engine.id]),
	diagnostic.engines.map((e) => `${e.engine.id}:${e.score}/${snapshot.scores.engineScores[e.engine.id]}`).join(', '),
);
assert(
	'HTTP diagnostic engines stay at Level 1',
	diagnostic.engines.every((engine) => engine.depthLevel === 1 && engine.currentStatus?.isLockedBySecurity === true),
);
assert(
	'HTTP diagnostic As-Is tags lead with security warnings',
	diagnostic.engines.every(
		(engine) =>
			engine.currentStatus?.statusTags[0] === '#HTTPS보안미적용' &&
			engine.currentStatus?.statusTags[1] === '#비보안출처_추천제한',
	),
);
assert(
	'HTTP engine scores stay at the 64 cap',
	Object.values(snapshot.scores.engineScores).every((n) => n <= HTTPS_ENGINE_SCORE_CAP),
);
assert('HTTPS alert copy is available', HTTPS_SECURITY_ALERT.ko.includes('HTTPS'));
assert(
	'ChatGPT key action names Bing Places',
	getEngineKeyAction('chatgpt', 'ko').includes('Bing Places'),
);
assert(
	'Perplexity key action names /llms.txt',
	getEngineKeyAction('perplexity', 'ko').includes('/llms.txt'),
);
assert(
	'Each engine exposes a 1-2-3 key-action roadmap',
	(['chatgpt', 'gemini', 'claude', 'perplexity', 'copilot', 'clova'] as const).every((id) => {
		const actions = getEngineKeyActions(id, 'ko');
		return (
			actions.length === 3 &&
			actions[0].rank === 1 &&
			actions[0].type === 'required' &&
			actions[1].rank === 2 &&
			actions[1].type === 'structure' &&
			actions[2].rank === 3 &&
			actions[2].type === 'trust'
		);
	}),
);
assert(
	'ChatGPT rank-2 action names JSON-LD schema',
	getEngineKeyActions('chatgpt', 'ko')[1].text.includes('JSON-LD'),
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall trigger-depth engine assertions passed');
