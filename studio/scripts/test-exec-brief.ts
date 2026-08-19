/**
 * Exec Brief copy binds live Level-1 AI index, P0 defects, and ROI
 * (33 → 77, +44%p) without hardcoded clinic names or guaranteed conversion %.
 * Run: npx tsx scripts/test-exec-brief.ts
 */
import {
	AI_INDEX_LEVEL3_FOUNDATION,
	buildExecBriefModel,
	engineLevelReason,
	estimateConversionLiftPct,
	projectExecBriefAiIndex,
	resolveExecBriefBindings,
	resolveIndexedKind,
	sanitizeExecBriefFilename,
} from '../lib/audit/exec-brief';
import type { AuditCheckItem, AuditReport } from '../lib/site-auditor';
import type { GeoDiagnosticSummary } from '../types/geo-diagnostic';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

function check(id: string, status: AuditCheckItem['status'], weight: number): AuditCheckItem {
	return { id, label: id, status, passed: status === 'pass', weight };
}

function stubClinic(partial?: Partial<AuditReport>): AuditReport {
	const checklist = [
		check('https', 'fail', 10),
		check('jsonld-present', 'fail', 8),
		check('organization', 'fail', 7),
		check('person-eeat', 'fail', 5),
		check('llms-txt', 'warning', 6),
		check('title', 'pass', 5),
	];
	return {
		url: 'http://nineone-clinic.example.com',
		lang: 'ko',
		fetchedAt: '2026-08-19T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 180,
		pageSizeBytes: 90_000,
		score: 49,
		maxScore: 122,
		status: 'POOR',
		statusLabel: '취약',
		hasSsl: false,
		schemaCoverage: 8,
		geoCitationScore: 22,
		siteMeta: {
			domain: 'nineone-clinic.example.com',
			brandName: '나인원의원',
			category: '피부과',
			primaryKeyword: '피부시술',
			industryType: 'MEDICAL',
			location: '대구 수성구',
			broadLocation: '대구',
			vertical: 'medical',
			targetUrl: 'http://nineone-clinic.example.com',
		},
		metrics: {
			titleLength: 18,
			metaDescriptionLength: 70,
			h1Count: 1,
			headingSkipDetected: false,
			imagesTotal: 8,
			imagesMissingAlt: 3,
			imageAltCoveragePct: 62,
			jsonLdBlockCount: 0,
			schemaTypes: [],
			bodyTextLength: 420,
			renderBlockingScripts: 2,
			hasLlmsTxt: false,
			organizationMissing: ['logo', 'url', 'sameAs'],
		},
		categories: [
			{
				id: 'schema',
				label: '스키마 구조화 데이터',
				score: 7.5,
				maxScore: 36,
				status: 'FAIL',
				statusNote: '',
				checks: [check('jsonld-present', 'fail', 8), check('organization', 'fail', 7)],
			},
		],
		checklist,
		findings: checklist
			.filter((item) => item.status !== 'pass')
			.map((item) => ({
				severity: item.status === 'fail' ? ('critical' as const) : ('warning' as const),
				title: item.label,
				detail: item.label,
				checkId: item.id,
			})),
		...partial,
	} as AuditReport;
}

assert('44pt gain → 38% conversion lift', estimateConversionLiftPct(44) === 38, estimateConversionLiftPct(44));
assert('zero gain → 0 lift', estimateConversionLiftPct(0) === 0);
assert('Level-1 index projects to 77', projectExecBriefAiIndex(33, true) === AI_INDEX_LEVEL3_FOUNDATION);
assert('no defects holds current index', projectExecBriefAiIndex(33, false) === 33);
assert('A-grade already in range holds', projectExecBriefAiIndex(88, true) === 88);

assert(
	'ChatGPT L1 low score is brand-only',
	engineLevelReason('chatgpt', 1, 30, 'ko') === '브랜드 한정 단순언급',
);
assert(
	'Claude L1 mid score is basic citation',
	engineLevelReason('claude', 1, 39, 'ko') === '기초 정보 인용 수준',
);
assert(
	'Perplexity L1 names local signal',
	engineLevelReason('perplexity', 1, 30, 'ko') === '로컬 추천 신호 취약',
);
assert(
	'Clova L1 names Place',
	engineLevelReason('clova', 1, 34, 'ko') === '플레이스 연동 신호 미흡',
);

const allLevel1: GeoDiagnosticSummary = {
	indexScore: 33,
	indexedCount: 6,
	totalEngines: 6,
	averageDepth: 1,
	levelCounts: { 1: 6, 2: 0, 3: 0 },
	unindexedCount: 0,
};
assert('6× L1 is mention-only', resolveIndexedKind(allLevel1) === 'mentionOnly');

const brief = buildExecBriefModel(stubClinic(), null, 'ko');
assert('site name is clinic brand', brief.siteName === '나인원의원');
assert('HTTP clinic AI index is 33', brief.aiIndex === 33, brief.aiIndex);
assert('ROI current uses AI index', brief.currentScore === brief.aiIndex);
assert('projected foundation is 77+', brief.projectedScore === 77, brief.projectedScore);
assert('gain is +44%p', brief.gain === 44, brief.gain);
assert('conversion lift is 38', brief.inflowLiftPct === 38, brief.inflowLiftPct);
assert('mention-only kind', brief.indexedKind === 'mentionOnly');
assert('brand-only tone', brief.statusTone === 'brandOnly');
assert(
	'status binds detected location + service',
	brief.statusHeadline.includes('대구 피부시술') && brief.statusHeadline.includes('상호명'),
	brief.statusHeadline,
);
assert('status avoids dropout claims', !brief.statusHeadline.includes('탈락'), brief.statusHeadline);
assert('judgment names Level 1', brief.judgmentText.includes('Level 1'), brief.judgmentText);
assert(
	'judgment binds brand with josa',
	brief.judgmentText.includes('나인원의원을') && brief.judgmentText.includes('분산'),
	brief.judgmentText,
);
assert(
	'judgment avoids revenue / competitor-first claims',
	!brief.judgmentText.includes('매출') && !brief.judgmentText.includes('경쟁'),
	brief.judgmentText,
);
assert('Copilot display name', brief.engines.some((row) => row.name === 'Microsoft Copilot'));
assert('Naver Cue display name', brief.engines.some((row) => row.name === 'Naver Cue'));
assert(
	'engine rows expose Level 1 reason',
	brief.engines.every((row) => row.depthLevel === 1 && row.levelLabel === 'Level 1' && row.reason.length > 0),
);

const ids = brief.improvements.map((item) => item.id);
assert('schema/EEAT is first P0', ids[0] === 'schema-eeat', ids.join(','));
assert('llms.txt is in TOP 3', ids.includes('llms-txt'), ids.join(','));
assert('SSL is in TOP 3', ids.includes('ssl-https'), ids.join(','));
assert(
	'schema cause names MedicalClinic',
	brief.improvements[0]?.causeLine.includes('MedicalClinic'),
	brief.improvements[0]?.causeLine,
);
assert(
	'schema status has 36 max',
	brief.improvements[0]?.statusLine.includes('/36'),
	brief.improvements[0]?.statusLine,
);
assert('three ROI effects', brief.roiEffects.length === 3, brief.roiEffects.length);
assert(
	'recommend effect binds location + service',
	brief.roiEffects[0]?.text.includes('대구 피부시술') && brief.roiEffects[0]?.text.includes('Citation Pool'),
	brief.roiEffects[0]?.text,
);
assert(
	'leakage effect is a simulation estimate',
	brief.roiEffects[1]?.text.includes('160') && brief.roiEffects[1]?.text.includes('시뮬레이션'),
	brief.roiEffects[1]?.text,
);
assert(
	'conversion effect is a contribution, not a % guarantee',
	brief.roiEffects[2]?.text.includes('개선 기여') && !brief.roiEffects[2]?.text.includes('38%'),
	brief.roiEffects[2]?.text,
);
assert(
	'schema cause is verify-difficulty, not a trust verdict',
	brief.improvements[0]?.causeLine.includes('검증하기 어려움'),
	brief.improvements[0]?.causeLine,
);
assert(
	'llms cause is a standard index path',
	brief.improvements.some((item) => item.id === 'llms-txt' && item.causeLine.includes('표준 인덱스')),
	brief.improvements.find((item) => item.id === 'llms-txt')?.causeLine,
);
assert(
	'ssl cause avoids patient-churn wording',
	brief.improvements.some((item) => item.id === 'ssl-https' && item.causeLine.includes('접속 안정성') && !item.causeLine.includes('환자')),
	brief.improvements.find((item) => item.id === 'ssl-https')?.causeLine,
);
assert('filename sanitizes clinic', sanitizeExecBriefFilename('나인원의원') === '나인원의원');
assert('bindings expose detected vars', brief.location === '대구' && brief.primaryService === '피부시술' && brief.estimatedLeads === 160);

const restaurant = buildExecBriefModel(
	stubClinic({
		siteMeta: {
			domain: 'omakase.example.com',
			brandName: '스시하나',
			category: '일식당',
			primaryKeyword: '오마카세',
			industryType: 'LOCAL_STORE',
			location: '강남구',
			broadLocation: '강남구',
			vertical: 'restaurant',
			targetUrl: 'http://omakase.example.com',
		},
	}),
	null,
	'ko',
);
assert(
	'restaurant status binds 강남구 오마카세',
	restaurant.statusHeadline.includes('강남구 오마카세') && restaurant.judgmentText.includes('스시하나를'),
	restaurant.statusHeadline,
);
assert(
	'restaurant ROI binds service + leads',
	restaurant.roiEffects[0]?.text.includes('강남구 오마카세') && restaurant.roiEffects[1]?.text.includes('200'),
	restaurant.roiEffects.map((item) => item.text).join(' | '),
);

const fallbackBindings = resolveExecBriefBindings({
	brandName: '',
	lang: 'ko',
});
assert('missing location falls back', fallbackBindings.location === '해당 지역', fallbackBindings.location);
assert('missing service falls back', fallbackBindings.primaryService === '핵심 서비스', fallbackBindings.primaryService);
assert('missing leads default to 160', fallbackBindings.estimatedLeads === 160, fallbackBindings.estimatedLeads);

const overrideLeads = resolveExecBriefBindings({
	brandName: '레드유',
	location: '성수',
	primaryKeyword: 'SaaS 솔루션',
	lostLeads: 88,
	lang: 'ko',
});
assert(
	'lostLeads overrides industry volume',
	overrideLeads.queryPhrase === '성수 SaaS 솔루션' && overrideLeads.estimatedLeads === 88,
	JSON.stringify(overrideLeads),
);

const httpsBrief = buildExecBriefModel(
	stubClinic({
		url: 'https://nineone-clinic.example.com',
		hasSsl: true,
		metrics: { ...(stubClinic().metrics as object), hasLlmsTxt: true } as AuditReport['metrics'],
		siteMeta: stubClinic().siteMeta,
	}),
	null,
	'ko',
);
assert(
	'HTTPS + llms still keeps schema P0 when schema is weak',
	httpsBrief.improvements.some((item) => item.id === 'schema-eeat'),
	httpsBrief.improvements.map((item) => item.id).join(','),
);

if (failed) {
	console.error(`failed: ${failed}`);
	process.exit(1);
}
console.log('\nexec-brief assertions passed');
