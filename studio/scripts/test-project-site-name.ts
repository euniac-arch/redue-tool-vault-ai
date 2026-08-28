/**
 * Project / diagnosis site-name priority: crawled brand → title → hostname.
 * Run: npx tsx scripts/test-project-site-name.ts
 */
import {
	cleanSiteName,
	isDomainLikeSiteName,
} from '../lib/audit/brand-name';
import {
	preferProjectName,
	resolveProjectSiteName,
} from '../lib/audit/project-site-name';
import type { AuditReport } from '../lib/site-auditor';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(cleanSiteName('나인원의원 | 대구 여의사 피부·성형 리프팅') === '나인원의원', 'pipe subtitle stripped');
assert(cleanSiteName('삼삼물산 | 공식 홈페이지') === '삼삼물산', 'samsam pipe stripped');
assert(isDomainLikeSiteName('nineoneclinic.com', 'nineoneclinic.com'), 'full host is domain-like');
assert(isDomainLikeSiteName('Nineoneclinic', 'nineoneclinic.com'), 'slug is domain-like');
assert(!isDomainLikeSiteName('나인원의원', 'nineoneclinic.com'), 'hangul brand is not domain-like');

const nineone = resolveProjectSiteName({
	url: 'https://nineoneclinic.com/',
	siteMeta: {
		domain: 'nineoneclinic.com',
		brandName: 'Nineoneclinic',
		ogSiteName: '나인원의원',
		organizationName: 'Nineoneclinic',
		ogTitle: '나인원의원 | 대구 여의사 피부·성형 리프팅',
		title: 'Nineoneclinic',
	},
	metrics: { pageTitle: '나인원의원 | 대구 여의사 피부·성형 리프팅' },
} as AuditReport);
assert(nineone === '나인원의원', `nineone got ${nineone}`);

const samsam = resolveProjectSiteName({
	url: 'https://samsammulsan.com/',
	siteMeta: {
		domain: 'samsammulsan.com',
		brandName: 'samsammulsan.com',
		ogTitle: '삼삼물산 | 공식',
		title: '삼삼물산 | 공식',
	},
	metrics: { pageTitle: '삼삼물산 | 공식' },
} as AuditReport);
assert(samsam === '삼삼물산', `samsam got ${samsam}`);

const domainOnly = resolveProjectSiteName({
	url: 'https://example.net/path',
	siteMeta: { domain: 'example.net', brandName: 'Example' },
	metrics: {},
} as AuditReport);
assert(domainOnly === 'example.net', `domain fallback got ${domainOnly}`);

assert(
	preferProjectName('nineoneclinic.com', '나인원의원', 'https://nineoneclinic.com/') === '나인원의원',
	'prefer hangul over hostname',
);
assert(
	preferProjectName('나인원의원', 'nineoneclinic.com', 'https://nineoneclinic.com/') === '나인원의원',
	'keep hangul when primary',
);

console.log('test-project-site-name: ok');
