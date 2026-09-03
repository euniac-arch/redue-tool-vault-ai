/**
 * 도입사례 Executive Summary Layer — narrative + routing contracts.
 * Run: npx tsx scripts/test-case-study-exec-summary.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	buildExecutiveNarrative,
	buildImprovementItems,
	buildNextSteps,
	resolveCaseStudyResultHref,
	schemaInjectionLabel,
} from '../lib/case-studies/executive-summary';
import type { CaseStudyData } from '../lib/case-study-types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

function sample(overrides: Partial<CaseStudyData> = {}): CaseStudyData {
	return {
		id: 'nineone',
		kind: 'verified',
		latestAuditId: 'audit-93',
		hasBaseline: true,
		siteInfo: {
			name: '나인원의원',
			domain: 'nineoneclinic.co.kr',
			domainUrl: 'https://nineoneclinic.co.kr',
			category: '의료 / 피부시술',
			techStack: 'Custom HTML',
			httpsEnabled: true,
			ttfbMs: 180,
			ttfbTone: 'good',
		},
		normalizedScore: {
			before: { score: 41, maxScore: 100, tone: 'critical', label: '노출 위험' },
			after: { score: 93, maxScore: 100, tone: 'good', label: '상위 추천 선점' },
		},
		algorithmScore: { before: 12, after: 28, maxScore: 30 },
		axes: [
			{
				key: 'seo',
				label: 'SEO 기술 기본기',
				before: { score: 48, raw: '14/29' },
				after: { score: 91, raw: '26/29' },
			},
			{
				key: 'performance',
				label: '웹 성능 & CWV',
				before: { score: 55, raw: '11/20' },
				after: { score: 82, raw: '16/20' },
			},
			{
				key: 'schema',
				label: '스키마 구조화',
				before: { score: 0, raw: '0/15', badge: { label: 'FAIL', tone: 'critical' } },
				after: { score: 100, raw: '15/15', badge: { label: 'PASS', tone: 'good' } },
			},
			{
				key: 'geo',
				label: 'GEO & AI 신뢰도',
				before: { score: 36, raw: '7/20' },
				after: { score: 88, raw: '18/20' },
			},
		],
		deficits: [],
		aiEngines: [],
		actionsTaken: [],
		...overrides,
	};
}

const narrative = buildExecutiveNarrative(sample());
assert('lift narrative uses real before/after', narrative.variant === 'lift' && narrative.beforeScore === '41' && narrative.afterScore === '93');
assert('large lift uses 대폭 개선', narrative.intensity === '대폭 개선되어');
assert('90+ after claims foundation complete', narrative.foundation.includes('100% 완료'));

const noBase = buildExecutiveNarrative(sample({ hasBaseline: false }));
assert('missing baseline uses after-only copy', noBase.variant === 'after-only');

const href = resolveCaseStudyResultHref(sample());
assert('result href opens audit original', href === '/audit/result?id=audit-93');

const schema = sample().axes.find((axis) => axis.key === 'schema');
assert('schema injection reads PASS badge', schemaInjectionLabel(schema, true) === 'JSON-LD 주입 완료');

const improvements = buildImprovementItems(sample());
assert('improvements stay at 3 items', improvements.length === 3);
assert(
	'schema copy uses MedicalBusiness for clinic',
	improvements.some((item) => item.detail.includes('MedicalBusiness/LocalBusiness')),
);

const steps = buildNextSteps(sample());
assert('next steps stay at 3 items', steps.length === 3);
assert('citation step mentions 시술/서비스', steps[0]?.detail.includes('시술/서비스'));

const taken = buildImprovementItems(
	sample({
		actionsTaken: [
			{ title: '구조화 데이터 완전 주입', detail: '실제 스키마 주입 완료' },
			{ title: '엔티티 보정', detail: 'Organization sameAs 연결' },
		],
	}),
);
assert('real actionsTaken come first', taken[0]?.detail === '실제 스키마 주입 완료' && taken[1]?.title === '엔티티 보정');

const root = process.cwd();
const card = readFileSync(join(root, 'components/portfolio/CaseStudyCard.tsx'), 'utf8');
const page = readFileSync(join(root, 'app/portfolio/page.tsx'), 'utf8');
const modal = readFileSync(join(root, 'components/portfolio/CaseStudyExecutiveSummaryModal.tsx'), 'utf8');

assert('card no longer links 진단 결과보기', !/진단 결과보기[\s\S]{0,80}<\/Link>/.test(card) && card.includes('type="button"'));
assert('card blocks navigation on click', card.includes('event.preventDefault()') && card.includes('onViewResult'));
assert('page holds selectedCaseData', page.includes('selectedCaseData') && page.includes('CaseStudyExecutiveSummaryModal'));
assert('modal reuses useModalA11y', modal.includes("from '@/lib/ui/use-modal-a11y'") && modal.includes('useModalA11y('));
assert('modal is a dialog', modal.includes('role="dialog"') && modal.includes('aria-modal="true"'));
assert('modal opens full report in a new tab', modal.includes('target="_blank"') && modal.includes('전체 상세 진단 결과 원본 보기'));
assert('modal uses glass container', modal.includes('bg-[#0b1324]/95') && modal.includes('backdrop-blur-2xl'));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall case-study executive summary assertions passed');
