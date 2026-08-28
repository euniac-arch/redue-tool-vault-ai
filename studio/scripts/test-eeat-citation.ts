/**
 * E-E-A-T Person + NAP + FAQPage/HowTo citation graph smoke tests.
 */
import {
	applyCmsAdapterWrap,
	normalizeCmsAdapterId,
	pickCmsInjectTarget,
} from '../lib/solve/adapters';
import {
	applyCitationExtrasToMain,
	buildFaqPageNode,
	buildHowToNode,
	buildPersonEeatNode,
	defaultFaqItems,
	defaultHowToSteps,
	ensureCitationMenuRows,
	excludeCitationVirtualFromSchemaPages,
	extractNapFromCorpus,
	FAQ_GUIDE_TITLE,
	HOWTO_GUIDE_TITLE,
	isCitationVirtualPage,
	isFaqGuidePage,
	isHowToGuidePage,
	organizationNodeId,
	personNodeId,
	inferKrPostalAddressFromIdentity,
	postalAddressNode,
	resolveCompleteNap,
} from '../lib/solve/core/eeat-citation';
import { extractStreetAddressFromText, extractTelephoneFromText } from '../lib/solve/core/entity-patterns';
import { generateDynamicPhpSchema } from '../lib/solve/dynamic-php-schema';
import { defaultPageSelected } from '../lib/solve/page-selection';
import type { SolvePageMeta } from '../lib/solve/types';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(extractTelephoneFromText('대표번호 : 02-1234-5678') === '02-1234-5678', 'nap tel labeled');
assert(extractTelephoneFromText('문의 1588-0000') === '1588-0000', 'nap tel 15xx');
assert(
	extractStreetAddressFromText('주소 : 서울 강남구 테헤란로 427') === '서울 강남구 테헤란로 427',
	'nap addr labeled capture',
);
assert(
	extractNapFromCorpus('TEL 031-123-4567 / 위치 경기 성남시 분당구 정자로 1').telephone === '031-123-4567',
	'corpus tel',
);

const nap = resolveCompleteNap({
	corpus: '전화 02-555-1212 주소 서울 서초구 강남대로 100',
	siteName: '레드유클리닉',
});
assert(nap.telephone === '02-555-1212', 'complete nap tel');
assert(/서울 서초구 강남대로/.test(nap.streetAddress), 'complete nap addr');
assert(nap.addressCountry === 'KR', 'complete nap country');

const fallbackNap = resolveCompleteNap({ siteName: '레드유클리닉' });
assert(fallbackNap.streetAddress === '레드유클리닉 소재지', 'site-based address fallback');
assert(fallbackNap.telephone === '', 'no dummy telephone');
assert(fallbackNap.addressLocality !== '', 'fallback locality filled');
assert(fallbackNap.addressRegion !== '', 'fallback region filled');
assert(postalAddressNode(fallbackNap)['@type'] === 'PostalAddress', 'postal node type');
assert(postalAddressNode(fallbackNap).addressCountry === 'KR', 'postal country');
assert(Boolean(postalAddressNode(fallbackNap).addressLocality), 'postal locality required');
assert(Boolean(postalAddressNode(fallbackNap).addressRegion), 'postal region required');

const gangseo = inferKrPostalAddressFromIdentity({ siteName: '강서24시동물병원' });
assert(gangseo.addressLocality === '강서구', `gangseo locality got=${gangseo.addressLocality}`);
assert(gangseo.addressRegion === '서울', `gangseo region got=${gangseo.addressRegion}`);
assert(gangseo.addressCountry === 'KR', 'gangseo country');

const person = buildPersonEeatNode({
	origin: 'https://clinic.example',
	canonicalUrl: 'https://clinic.example/',
	siteName: '레드유클리닉',
	repName: '김원장',
	repTitle: '대표원장',
	knowsAbout: ['면역치료', '중입자'],
	alumniOf: '서울대학교',
});
assert(person, 'person built when name exists');
assert(person['@id'] === personNodeId('https://clinic.example'), 'person @id');
assert(person.name === '김원장', 'person name');
assert(person.jobTitle === '대표원장', 'person title');
assert((person.worksFor as { '@id': string })['@id'] === organizationNodeId('https://clinic.example'), 'worksFor');
assert(Array.isArray(person.knowsAbout) && (person.knowsAbout as string[]).includes('면역치료'), 'knowsAbout');
assert((person.alumniOf as { name: string }).name === '서울대학교', 'alumniOf');

const fallbackPerson = buildPersonEeatNode({
	origin: 'https://clinic.example',
	canonicalUrl: 'https://clinic.example/',
	siteName: '레드유클리닉',
});
assert(fallbackPerson === null, 'no invented Person without real name');

const faqs = defaultFaqItems('레드유클리닉', 'https://clinic.example', { opens: '09:30', closes: '17:30', telephone: '02-555-1212' });
assert(faqs.length === 3, 'default faq count');
assert(faqs.some((f) => /진료시간/.test(f.q) && /09:30/.test(f.a)), 'faq hours');
assert(faqs.some((f) => /주차/.test(f.q)), 'faq parking');
assert(faqs.some((f) => /예약/.test(f.q) && /02-555-1212/.test(f.a)), 'faq reserve');
const faqNode = buildFaqPageNode({ canonicalUrl: 'https://clinic.example/', items: faqs });
assert(faqNode?.['@type'] === 'FAQPage', 'faq node type');

const steps = defaultHowToSteps('레드유클리닉');
assert(steps.length === 4, 'howto 4 steps');
assert(buildHowToNode({ canonicalUrl: 'https://clinic.example/', siteName: '레드유클리닉' }) === null, 'howto skipped without extracted steps');
const howto = buildHowToNode({ canonicalUrl: 'https://clinic.example/', siteName: '레드유클리닉', steps });
assert(howto?.['@type'] === 'HowTo', 'howto type');
assert((howto?.step as unknown[]).length === 4, 'howto step count');

const pages: SolvePageMeta[] = [
	{ urlPath: '/', title: '메인', selected: true },
	{ urlPath: '/intro.php', title: '병원소개', selected: true },
];
const noDummy = ensureCitationMenuRows(pages, { siteName: '레드유클리닉' });
assert(!noDummy.some((p) => p.virtual), 'no dummy FAQ/HowTo without live content');

const leftoverVirtual = ensureCitationMenuRows(
	[
		...pages,
		{ urlPath: '/faq', title: FAQ_GUIDE_TITLE, virtual: true },
		{ urlPath: '/howto', title: HOWTO_GUIDE_TITLE, virtual: true },
	],
	{ siteName: '레드유클리닉' },
);
assert(!leftoverVirtual.some((p) => p.urlPath === '/faq' || p.urlPath === '/howto' || p.virtual), 'strip leftover virtual rows');

const withCitation = ensureCitationMenuRows(pages, {
	siteName: '레드유클리닉',
	allowVirtual: true,
	hasFaqContent: true,
	hasHowToContent: true,
});
assert(withCitation.some((p) => p.title === FAQ_GUIDE_TITLE && p.selected !== false), 'virtual faq row opt-in');
assert(withCitation.some((p) => p.title === HOWTO_GUIDE_TITLE && p.selected !== false), 'virtual howto row opt-in');
assert(withCitation.filter((p) => isCitationVirtualPage(p)).every((p) => defaultPageSelected(p)), 'virtual checked');

const realFaq: SolvePageMeta[] = [
	{ urlPath: '/', title: '메인' },
	{ urlPath: '/faq.php', title: '자주 묻는 질문', section: '이용안내' },
	{ urlPath: '/reserve.php', title: '예약안내' },
];
const reused = ensureCitationMenuRows(realFaq, { siteName: '레드유클리닉' });
assert(reused.some((p) => p.urlPath === '/faq.php' && isFaqGuidePage(p)), 'reuse real faq');
assert(reused.some((p) => p.urlPath === '/reserve.php' && isHowToGuidePage(p)), 'reuse real howto');
assert(!reused.some((p) => p.virtual && p.urlPath === '/faq'), 'no duplicate virtual faq');

const mapped = excludeCitationVirtualFromSchemaPages(applyCitationExtrasToMain(withCitation));
assert(mapped.every((p) => !isCitationVirtualPage(p)), 'virtual excluded from schema map');
const home = mapped.find((p) => p.urlPath === '/');
assert(home?.extraTypes?.includes('FAQPage'), 'faq extra on main');
assert(home?.extraTypes?.includes('HowTo'), 'howto extra on main');

const php = generateDynamicPhpSchema(
	{
		siteName: '레드유클리닉',
		pages: {
			'index.php': { title: '메인', desc: '소개', schemaType: 'WebPage', extraTypes: ['HowTo', 'FAQPage'] },
		},
	},
	{
		siteName: '레드유클리닉',
		targetUrl: 'https://clinic.example',
		cmsType: 'WordPress',
		footerText: '대표번호 : 02-1234-5678 주소 : 서울 강남구 테헤란로 427',
		representativeName: '김원장',
		representativeTitle: '대표원장',
		telephone: '02-1234-5678',
		streetAddress: '서울 강남구 테헤란로 427',
	},
);
assert(php.includes("'@type' => 'Person'"), 'php person');
assert(php.includes("$origin . '/#person'"), 'php person id');
assert(php.includes("$org_node['founder'] = array('@id' => $origin . '/#person')"), 'php founder @id');
assert(php.includes("'author' => array('@id' => $origin . '/#person')"), 'php webpage author');
assert(php.includes("'@type' => 'HowTo'"), 'php howto node available');
assert(php.includes('schema_howto_steps'), 'php howto only from live steps');
assert(php.includes('redue_extract_howto_steps'), 'php extracts howto from page body');
assert(php.includes('redue_extract_faq_items'), 'php extracts faq from page body');
assert(php.includes('redue_collect_page_body_html'), 'php collects wr_content/co_content');
assert(!php.includes('진료/상담 예약'), 'php does not invent howto steps');
assert(!php.includes('진료시간은 어떻게 되나요'), 'php does not invent faq hours');
assert(php.includes('schema_faq_items'), 'php faq only from live items');
assert(php.includes("$org_node['employee']"), 'php employee @id');
assert(!php.includes("unset($org_node['telephone'])"), 'php never unsets telephone');
assert(php.includes("$GLOBALS['redue_tel']"), 'php seeds redue_tel');
assert(php.includes('소재지') || php.includes('streetAddress'), 'php address bind');
assert(php.includes('$schema_pages'), 'php schema_pages map');
assert(php.includes("'addressLocality'"), 'php addressLocality');
assert(php.includes("'addressRegion'"), 'php addressRegion');
assert(php.includes("'addressCountry' => 'KR'"), 'php addressCountry');
assert(php.includes("'knowsAbout'"), 'php person/org knowsAbout');
assert(php.includes("'about' => array('@id' => $origin . '/#organization')"), 'php webpage about');
assert(!php.includes('\u00A0'), 'php has no NBSP');

const gnu = applyCmsAdapterWrap(php.replace(/WordPress adapter[^\n]*/g, ''), 'Gnuboard', 'theme/clinic/head.sub.php');
assert(/REDUE_AI_STUDIO:START/.test(gnu), 'gnu marker');
assert(pickCmsInjectTarget(['theme/clinic/head.sub.php'], 'Gnuboard') === 'theme/clinic/head.sub.php', 'gnu inject');
assert(normalizeCmsAdapterId('WordPress') === 'wordpress', 'wp adapter');

console.log('ok  eeat-citation pack');
