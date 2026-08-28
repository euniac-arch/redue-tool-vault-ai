/**
 * Config-based Schema.org JSON-LD module.
 * Run: npx tsx scripts/test-schema-jsonld.ts
 */
import {
	buildSchemaJsonLd,
	filterValidSchemaUrls,
	formatSchemaScriptTag,
	isValidSchemaUrl,
	mergeSameAsFromConfig,
	renderSchemaJsonLdHtml,
	schemaHasFounderKnowledgeGraph,
	schemaHasNaverSameAs,
} from '../lib/schema/jsonld';
import { graphOrgNode } from '../lib/solve/core/strict-schema-graph';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(isValidSchemaUrl('') === false, 'empty url rejected');
assert(isValidSchemaUrl('   ') === false, 'whitespace url rejected');
assert(isValidSchemaUrl('not-a-url') === false, 'bare host rejected');
assert(isValidSchemaUrl('javascript:alert(1)') === false, 'javascript: rejected');
assert(isValidSchemaUrl('https://blog.naver.com/clinic') === true, 'https accepted');

assert(
	filterValidSchemaUrls(['', null, undefined, 'https://x.com/a', 'ftp://x.com']).join(',') === 'https://x.com/a',
	'filter(Boolean) + invalid protocols dropped',
);

const merged = mergeSameAsFromConfig({
	url: 'https://clinic.example.com',
	sameAs: ['https://www.instagram.com/clinic', '', 'https://clinic.example.com/'],
	channels: {
		naverBlog: 'https://blog.naver.com/clinic',
		naverCafe: 'https://cafe.naver.com/clinic',
		naverPlace: 'https://map.naver.com/p/entry/place/123',
		facebook: '',
		youtube: 'not-a-url',
	},
});
assert(merged.includes('https://blog.naver.com/clinic'), 'merges naver blog');
assert(merged.includes('https://cafe.naver.com/clinic'), 'merges naver cafe');
assert(merged.includes('https://map.naver.com/p/entry/place/123'), 'merges naver place');
assert(merged.includes('https://www.instagram.com/clinic'), 'merges instagram');
assert(!merged.includes('https://clinic.example.com/'), 'drops own origin');
assert(!merged.some((url) => url === ''), 'no empty string in sameAs');

const empty = buildSchemaJsonLd({
	name: '테스트의원',
	url: 'https://clinic.example.com',
	channels: { naverBlog: '', naverCafe: '', naverPlace: '', instagram: '' },
	founder: { name: '', jobTitle: '대표원장', sameAs: [''] },
});
assert(schemaHasFounderKnowledgeGraph(empty) === false, 'no Person / founder without real name');
assert(graphOrgNode(empty)?.sameAs === undefined, 'no sameAs when every channel is empty');
assert(schemaHasNaverSameAs(empty) === false, 'empty config has no naver signal');

const full = buildSchemaJsonLd({
	name: '서초내과의원',
	url: 'https://clinic.example.com',
	logo: 'https://clinic.example.com/logo.png',
	description: '서초 소재 내과 의원',
	telephone: '02-555-1212',
	address: {
		streetAddress: '서울 서초구 서초대로 10',
		addressLocality: '서초구',
		addressRegion: '서울특별시',
	},
	orgTypes: ['MedicalClinic', 'LocalBusiness'],
	channels: {
		naverBlog: 'https://blog.naver.com/seocho',
		naverCafe: 'https://cafe.naver.com/seocho',
		naverPlace: 'https://place.naver.com/hospital/123',
		instagram: 'https://www.instagram.com/seocho',
		facebook: '',
	},
	sameAs: ['', 'https://www.youtube.com/@seocho'],
	founder: {
		name: '김원장',
		jobTitle: '대표원장',
		sameAs: ['https://www.linkedin.com/in/drkim', '', 'javascript:void(0)'],
		alumniOf: { name: '서울대학교 의과대학', url: 'https://medicine.snu.ac.kr' },
		knowsAbout: ['내과', '', '건강검진'],
		url: 'https://clinic.example.com/doctors/kim',
	},
});

const org = graphOrgNode(full)!;
const person = full['@graph'].find((node) => node['@type'] === 'Person') as Record<string, unknown>;
const website = full['@graph'].find((node) => node['@type'] === 'WebSite') as Record<string, unknown>;
const crumb = full['@graph'].find((node) => node['@type'] === 'BreadcrumbList');

assert(Array.isArray(org['@type']) && org['@type'].includes('LocalBusiness'), 'org includes LocalBusiness');
assert(org.name === '서초내과의원', 'org name');
assert(org.url === 'https://clinic.example.com', 'org url');
assert(org.description === '서초 소재 내과 의원', 'org description');
assert(org.telephone === '02-555-1212', 'org telephone');
assert((org.logo as { url?: string })?.url === 'https://clinic.example.com/logo.png', 'org logo');
assert((org.address as { streetAddress?: string })?.streetAddress === '서울 서초구 서초대로 10', 'org address');
assert((org.founder as { '@id': string })['@id'].endsWith('/#person'), 'founder @id linked');
assert(schemaHasFounderKnowledgeGraph(full) === true, '대표자 지식그래프 linked');
assert(schemaHasNaverSameAs(full) === true, '네이버 플레이스·블로그 sameAs present');

const sameAs = org.sameAs as string[];
assert(sameAs.includes('https://blog.naver.com/seocho'), 'sameAs blog');
assert(sameAs.includes('https://cafe.naver.com/seocho'), 'sameAs cafe');
assert(sameAs.includes('https://place.naver.com/hospital/123'), 'sameAs place');
assert(sameAs.includes('https://www.youtube.com/@seocho'), 'sameAs youtube from flat list');
assert(!sameAs.includes(''), 'sameAs has no empty string');

assert(person.name === '김원장', 'person name');
assert(person.jobTitle === '대표원장', 'person jobTitle');
assert((person.worksFor as { '@id': string })['@id'].endsWith('/#organization'), 'person worksFor org');
assert((person.sameAs as string[]).includes('https://www.linkedin.com/in/drkim'), 'person sameAs');
assert(!(person.sameAs as string[]).includes(''), 'person sameAs filtered');
assert((person.alumniOf as { name?: string; url?: string }).name === '서울대학교 의과대학', 'alumniOf name');
assert((person.alumniOf as { url?: string }).url === 'https://medicine.snu.ac.kr', 'alumniOf url');
assert(JSON.stringify(person.knowsAbout) === JSON.stringify(['내과', '건강검진']), 'knowsAbout compacted');
assert(person.url === 'https://clinic.example.com/doctors/kim', 'person url');
assert(website.inLanguage === 'ko-KR', 'website language default');
assert(crumb !== undefined, 'breadcrumb node present');

const titleOnly = buildSchemaJsonLd({
	name: '테스트의원',
	url: 'https://clinic.example.com',
	founder: { name: '대표원장' },
});
assert(schemaHasFounderKnowledgeGraph(titleOnly) === false, 'title-only 대표원장 is not a Person');

const html = renderSchemaJsonLdHtml({
	name: '서초내과의원',
	url: 'https://clinic.example.com',
	channels: { naverBlog: 'https://blog.naver.com/seocho' },
	founder: { name: '김원장', jobTitle: '대표원장' },
});
assert(html.startsWith('<script type="application/ld+json">'), 'script tag open');
assert(html.includes('"@type": "Person"'), 'script contains Person');
assert(html.includes('blog.naver.com/seocho'), 'script contains naver blog');
assert(formatSchemaScriptTag({ '@context': 'https://schema.org' }).includes('application/ld+json'), 'formatter');

console.log('test-schema-jsonld: ok');
