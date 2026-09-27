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
import {
	REDUE_HOME_FAQS,
	REDUE_META_DESCRIPTION_EN,
	REDUE_META_DESCRIPTION_KO,
	REDUE_OG_DESCRIPTION_EN,
	REDUE_OG_DESCRIPTION_KO,
	REDUE_SITE_SCHEMA,
} from '../lib/schema/site-schema-config';
import koMessages from '../messages/ko.json';
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

/** 구글 스니펫 권장 70~160자. 감사에서 69자가 "너무 짧음"으로 잡혔으므로 하한을 85로 올립니다. */
const META_MIN = 85;
const META_MAX = 160;
const koLen = [...REDUE_META_DESCRIPTION_KO].length;
const enLen = [...REDUE_META_DESCRIPTION_EN].length;
assert(koLen >= META_MIN && koLen <= META_MAX, `ko meta description length ${koLen} outside ${META_MIN}~${META_MAX}`);
assert(enLen >= META_MIN && enLen <= META_MAX, `en meta description length ${enLen} outside ${META_MIN}~${META_MAX}`);
assert(REDUE_META_DESCRIPTION_KO.includes('Schema'), 'ko meta description names Schema 마크업');
assert(
	['ChatGPT', 'Perplexity', 'Gemini'].every((engine) => REDUE_META_DESCRIPTION_KO.includes(engine)),
	'ko meta description names the generative engines',
);
assert(REDUE_META_DESCRIPTION_KO.includes('지식패널'), 'ko meta description names 지식패널');

/** 공유 카드는 2~3줄에서 잘리므로 meta description보다 짧게 유지합니다. */
const ogKoLen = [...REDUE_OG_DESCRIPTION_KO].length;
const ogEnLen = [...REDUE_OG_DESCRIPTION_EN].length;
assert(ogKoLen >= 60 && ogKoLen < koLen, `og ko description length ${ogKoLen} must be shorter than meta`);
assert(ogEnLen >= 60 && ogEnLen < enLen, `og en description length ${ogEnLen} must be shorter than meta`);

const site = buildSchemaJsonLd(REDUE_SITE_SCHEMA);
const types = site['@graph'].map((node) => node['@type']);
assert(types.includes('WebSite'), 'site WebSite');
assert(types.includes('BreadcrumbList'), 'site BreadcrumbList');
assert(types.includes('AboutPage'), 'site AboutPage');
assert(types.includes('FAQPage'), 'site FAQPage');
assert(types.includes('Person'), 'site Person');
const siteOrg = graphOrgNode(site)!;
const orgTypes = siteOrg['@type'] as string[];
assert(
	['Organization', 'LocalBusiness', 'ProfessionalService'].every((type) => orgTypes.includes(type)),
	'site org types combine Organization + LocalBusiness + ProfessionalService',
);
assert(siteOrg.name === 'REDUE AI SEO & GEO Studio', 'site org name');
assert(siteOrg.url === 'https://reduegeo.com/', 'site org url');
assert(siteOrg.telephone === '010-3210-9801', 'site telephone matches footer');
assert(siteOrg.taxID === koMessages.landing.footer.legal.bizNo, 'site taxID matches footer 사업자등록번호');
assert((siteOrg.logo as { url?: string })?.url === 'https://reduegeo.com/images/og-image.png', 'site org logo');
assert(siteOrg.description === REDUE_META_DESCRIPTION_KO, 'site org description');
const siteAddress = siteOrg.address as {
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	postalCode?: string;
	addressCountry?: string;
};
assert(siteAddress.addressRegion === '부산광역시', 'site address region matches footer');
assert(siteAddress.addressLocality === '사하구', 'site address locality matches footer');
assert(siteAddress.postalCode === '49459', 'site postalCode');
assert(siteAddress.addressCountry === 'KR', 'site address country');
assert(
	`${siteAddress.addressRegion} ${siteAddress.addressLocality} ${siteAddress.streetAddress} (우편번호 ${siteAddress.postalCode})` ===
		koMessages.landing.footer.legal.address,
	'site address concatenates to the visible footer address (NAP consistency)',
);
assert(siteOrg.telephone === koMessages.landing.footer.legal.phone, 'site telephone matches visible footer');
assert((siteOrg.sameAs as string[]).length > 0, 'site org sameAs present');
assert((siteOrg.founder as { '@id': string })['@id'] === 'https://reduegeo.com/#author', 'founder @id');
assert(siteOrg.contactPoint !== undefined, 'site contactPoint');
assert(schemaHasFounderKnowledgeGraph(site) === true, 'public site founder graph');
const sitePerson = site['@graph'].find((node) => node['@type'] === 'Person') as Record<string, unknown>;
assert(sitePerson['@id'] === 'https://reduegeo.com/#author', 'person @id');
assert(sitePerson.name === '박성준 (Sung Joon Park)', 'person name');
assert(sitePerson.jobTitle === 'CEO & Principal GEO/SEO Engineer', 'person jobTitle');
assert(
	sitePerson.description === '15년 이상의 웹 퍼블리싱 및 AI 검색 최적화(GEO), 프론트엔드 아키텍처 전문가',
	'person description',
);
assert(
	JSON.stringify(sitePerson.knowsAbout) ===
		JSON.stringify([
			'Generative Engine Optimization (GEO)',
			'Search Engine Optimization (SEO)',
			'Schema.org Markup',
			'Web Publishing',
			'Perplexity & ChatGPT Search Citation',
		]),
	'person knowsAbout',
);
assert((sitePerson.worksFor as { '@id': string })['@id'] === 'https://reduegeo.com/#organization', 'person worksFor');
const siteWeb = site['@graph'].find((node) => node['@type'] === 'WebSite') as Record<string, unknown>;
assert(siteWeb['@id'] === 'https://reduegeo.com/#website', 'website @id');
assert(siteWeb.url === 'https://reduegeo.com/', 'website url');
assert((siteWeb.potentialAction as { '@type'?: string })['@type'] === 'SearchAction', 'site SearchAction');
assert((siteWeb.breadcrumb as { '@id': string })['@id'] === 'https://reduegeo.com/#breadcrumb', 'website breadcrumb');
assert((siteWeb.publisher as { '@id': string })['@id'] === 'https://reduegeo.com/#organization', 'website publisher');
assert((siteWeb.author as { '@id': string })['@id'] === 'https://reduegeo.com/#author', 'website author');
const about = site['@graph'].find((node) => node['@type'] === 'AboutPage') as Record<string, unknown>;
assert(about['@id'] === 'https://reduegeo.com/#about', 'about @id');
assert(about.url === 'https://reduegeo.com/', 'about url');
assert((about.publisher as { '@id': string })['@id'] === 'https://reduegeo.com/#organization', 'about publisher');
assert((about.author as { '@id': string })['@id'] === 'https://reduegeo.com/#author', 'about author');
assert((about.about as { '@id': string })['@id'] === 'https://reduegeo.com/#organization', 'about entity');
const faq = site['@graph'].find((node) => node['@type'] === 'FAQPage') as {
	'@id'?: string;
	mainEntity?: Array<{ name?: string; acceptedAnswer?: { text?: string } }>;
};
assert(faq['@id'] === 'https://reduegeo.com/#faq', 'faq @id');
assert((faq.mainEntity || []).length === 5, 'site FAQ count');
REDUE_HOME_FAQS.forEach((item, index) => {
	const entity = faq.mainEntity?.[index];
	assert(entity?.name === item.question, `faq question ${index}`);
	assert(entity?.acceptedAnswer?.text === item.answer, `faq answer ${index}`);
});
const visibleFaq = koMessages.landing.story.faq.items;
const visibleKeys = ['renewal', 'timing', 'builder', 'rank', 'diff'] as const;
visibleKeys.forEach((key, index) => {
	assert(visibleFaq[key].q === REDUE_HOME_FAQS[index].question, `visible faq q ${key}`);
	assert(visibleFaq[key].a === REDUE_HOME_FAQS[index].answer, `visible faq a ${key}`);
});
const webpage = site['@graph'].find((node) => node['@type'] === 'WebPage') as Record<string, unknown>;
assert((webpage.publisher as { '@id': string })['@id'].endsWith('/#organization'), 'publisher linked');
assert((webpage.author as { '@id': string })['@id'] === 'https://reduegeo.com/#author', 'webpage author is person');

console.log('test-schema-jsonld: ok');
