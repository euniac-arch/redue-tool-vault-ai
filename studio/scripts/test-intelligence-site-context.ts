/**
 * Site Intelligence Context — diagnosis fields must follow the current URL.
 * A leftover clinic audit must never leak into another domain.
 * Run: npx tsx scripts/test-intelligence-site-context.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateUniversalQueries } from '../lib/ai-search-intelligence/query-intelligence/generate';
import { asiSitesMatch } from '../lib/ai-search-intelligence/normalize-site-url';
import {
	getSiteIntelligenceContext,
	resolveAsiTargetContext,
	servicesFromAudit,
} from '../lib/ai-search-intelligence/target';
import type { LatestAuditPayload } from '../lib/audit/latest-audit-payload';
import type { AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function auditFor(url: string, meta: Record<string, unknown>): LatestAuditPayload {
	return {
		auditId: `audit-${url}`,
		report: {
			url,
			siteMeta: meta,
			realCompetitors: { names: ['준피부과의원', '미담한의원'] },
		} as unknown as AuditReport,
		defectCount: 0,
		score: 70,
		maxScore: 100,
		savedAt: '2026-09-03T00:00:00.000Z',
	};
}

const CLINIC_META = {
	brandName: '테스트피부과의원',
	category: '피부과',
	primaryKeyword: '피부시술',
	location: '대구',
	coreSpecialties: ['리프팅', '보톡스', '필러'],
	serviceKeywords: ['피부시술'],
};

const ION_META = {
	brandName: '한국중입자 암치료연구소',
	category: '중입자 치료',
	primaryKeyword: '중입자치료',
	location: '서울 서초구',
	title: '한국중입자 암치료연구소',
	metaDescription: '해외 중입자 암치료 상담과 이온 치료 연구',
	businessEntity: '해외 중입자 치료 상담',
	coreSpecialties: ['중입자치료', '암치료'],
	detectedKeywords: ['암치료', '중입자', '이온', '항암'],
	entityPhrases: ['암치료연구소'],
};

const targetClientSrc = [
	readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/target/context.ts'), 'utf8'),
	readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/target/client.ts'), 'utf8'),
	readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/target/index.ts'), 'utf8'),
	readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/target/matching-audit.ts'), 'utf8'),
].join('\n');
assert(
	'target adapters never import async_hooks',
	!/from ['"]async_hooks['"]|from ['"][^'"]*guard\/context['"]/.test(targetClientSrc),
);

assert('http and https of the same host match', asiSitesMatch('http://koreaionlab.co.kr', 'https://koreaionlab.co.kr/'));
assert('www is ignored', asiSitesMatch('https://www.koreaionlab.co.kr', 'http://koreaionlab.co.kr'));
assert('different hosts do not match', !asiSitesMatch('http://koreaionlab.co.kr', 'https://nineoneclinic.com'));

const leaked = getSiteIntelligenceContext({
	url: 'http://koreaionlab.co.kr',
	audit: auditFor('https://clinic-fixture.example/', CLINIC_META),
});
assert('mismatched audit is not bound', leaked?.boundFromAudit === false);
assert('mismatched audit does not copy industry', !/피부|시술/.test(leaked?.industry || ''));
assert(
	'mismatched audit does not copy services',
	!(leaked?.services ?? []).some((item) => /피부|리프팅|보톡스|필러/.test(item)),
);
assert(
	'servicesFromAudit ignores foreign diagnosis',
	servicesFromAudit(
		{ url: 'http://koreaionlab.co.kr', audit: auditFor('https://clinic-fixture.example/', CLINIC_META) },
		'중입자치료',
	).every((item) => !/피부|리프팅|보톡스/.test(item)),
);

const ion = getSiteIntelligenceContext({
	url: 'http://koreaionlab.co.kr',
	audit: auditFor('https://koreaionlab.co.kr/', ION_META),
});
assert('http analysis binds https diagnosis', ion?.boundFromAudit === true);
assert('industry is cancer lab', /암치료 연구소/.test(ion?.industry || ''), ion?.industry);
assert('location stays 서초', ion?.location === '서울 서초구');
assert('services include cancer solution', (ion?.services ?? []).some((item) => /암 연구\/치료/.test(item)));
assert('services keep 중입자', (ion?.services ?? []).some((item) => /중입자/.test(item)));
assert('no derm leftover in services', !(ion?.services ?? []).some((item) => /피부|보톡스|필러|리프팅/.test(item)));
assert('target is cancer caregivers', /암 환우/.test(ion?.targetAudience || ''), ion?.targetAudience);
assert('keywords include 암치료', (ion?.keywords ?? []).includes('암치료'));
assert('keywords include 중입자', (ion?.keywords ?? []).includes('중입자'));

const queries = generateUniversalQueries(ion!, { limit: 16 });
const texts = queries.items.map((item) => item.query).join(' | ');
assert('query status generated', queries.status === 'QUERY_GENERATED');
assert('discovery uses cancer keyword', queries.items.some((item) => /암치료|중입자|연구소/.test(item.query)));
assert('recommend uses 국내 + keyword', queries.items.some((item) => /국내/.test(item.query) && /어디가 좋나요/.test(item.query)));
assert('compare uses brand', queries.items.some((item) => item.query.includes(ION_META.brandName)));
assert('queries drop 피부/시술', !/피부|시술/.test(texts), texts);

const alias = resolveAsiTargetContext({
	url: 'https://koreaionlab.co.kr/',
	audit: auditFor('http://koreaionlab.co.kr', ION_META),
});
assert('resolveAsiTargetContext is the same adapter', alias?.industry === ion?.industry);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
