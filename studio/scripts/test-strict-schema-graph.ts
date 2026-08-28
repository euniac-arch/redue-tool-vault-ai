/**
 * Strict Ground-Truth schema graph — omit empty / invented nodes.
 * Run: npx tsx scripts/test-strict-schema-graph.ts
 */
import {
	buildStrictSchemaGraph,
	graphHasPerson,
	graphOrgNode,
	isDummyPhoneNumber,
	isDummyTaxId,
	isKoreanTaxIdChecksumValid,
	isTitleOnlyRepName,
	isValidGroundTruthRepName,
	normalizeGroundTruthServices,
	normalizeGroundTruthTaxId,
} from '../lib/solve/core/strict-schema-graph';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(isValidGroundTruthRepName('김원장') === true, 'real korean name');
assert(isValidGroundTruthRepName('대표자명') === false, 'reject 대표자명');
assert(isValidGroundTruthRepName('대표원장') === false, 'reject title-as-name');
assert(isValidGroundTruthRepName('') === false, 'reject empty name');
assert(isTitleOnlyRepName('대표') === true, 'title-only 대표');

assert(isDummyPhoneNumber('050-0000-0000') === true, 'dummy 050');
assert(isDummyPhoneNumber('02-555-1212') === false, 'real seoul tel');
assert(isDummyTaxId('000-00-00000') === true, 'dummy tax zeros');
assert(isDummyTaxId('120-81-47521') === false, 'real patterned tax');

assert(isKoreanTaxIdChecksumValid('120-81-47521') === true, 'checksum 120-81-47521');
assert(isKoreanTaxIdChecksumValid('123-45-67890') === false, 'checksum 123-45-67890 fails');
assert(normalizeGroundTruthTaxId('000-00-00000') === '', 'dummy tax omitted');
assert(normalizeGroundTruthTaxId('120-81-47521') === '120-81-47521', 'checksum tax kept');
assert(normalizeGroundTruthTaxId('123-45-67890', { labeled: true }) === '123-45-67890', 'labeled pattern kept');
assert(normalizeGroundTruthTaxId('1234567890', { labeled: false }) === '', 'unlabeled bad checksum omitted');

assert(normalizeGroundTruthServices([], []).length === 0, 'empty catalog omitted');
assert(normalizeGroundTruthServices(['임플란트'], []).length === 1, 'real service kept');
assert(normalizeGroundTruthServices([], [{ name: '홈', url: '/' }]).length === 0, 'GNB 홈 is not a service');
assert(normalizeGroundTruthServices([], [{ name: '내과진료', url: '/s500.php' }]).length === 1, 'GNB service kept');

const empty = buildStrictSchemaGraph({ origin: 'https://clinic.example.com', siteName: '테스트의원' });
assert(graphHasPerson(empty) === false, 'no Person without repName');
const emptyOrg = graphOrgNode(empty);
assert(emptyOrg !== undefined, 'org exists');
assert(emptyOrg?.founder === undefined, 'no founder without person');
assert(emptyOrg?.employee === undefined, 'no employee without person');
assert(emptyOrg?.sameAs === undefined, 'no sameAs without channels');
assert(emptyOrg?.hasOfferCatalog === undefined, 'no catalog without services');
assert(emptyOrg?.taxID === undefined, 'no taxID without extract');
assert(emptyOrg?.faxNumber === undefined, 'no fax without extract');
assert(emptyOrg?.telephone === undefined, 'no telephone without extract');
assert(JSON.stringify(empty).includes('홍길동') === false, 'no 홍길동 baked');
assert(JSON.stringify(empty).includes('050-0000-0000') === false, 'no dummy phone baked');
assert(JSON.stringify(empty).includes('대표자명') === false, 'no 대표자명 baked');

const page = empty['@graph'].find((n) => n['@type'] === 'WebPage' || n['@type'] === 'MedicalWebPage');
assert(page?.isPartOf !== undefined && page?.about !== undefined, 'WebPage links to WebSite + Organization');

const full = buildStrictSchemaGraph({
	origin: 'https://clinic.example.com',
	siteName: '서초내과의원',
	repName: '김원장',
	repTitle: '대표원장',
	repSameAs: ['https://www.linkedin.com/in/drkim', ''],
	alumniOf: '서울대학교 의과대학',
	knowsAbout: ['내과', ''],
	telephone: '02-555-1212',
	taxId: '120-81-47521',
	faxNumber: '02-555-3434',
	streetAddress: '서울 서초구 서초대로 10',
	sameAs: ['https://blog.naver.com/seocho'],
	services: [{ name: '내과진료', url: '/s500.php' }],
	pageUrl: 'https://clinic.example.com/',
	pageName: '홈',
});
assert(graphHasPerson(full) === true, 'Person when name exists');
const fullOrg = graphOrgNode(full)!;
assert((fullOrg.founder as { '@id': string })['@id'].endsWith('/#person'), 'founder @id');
assert((fullOrg.employee as { '@id': string })['@id'].endsWith('/#person'), 'employee @id');
const fullPerson = full['@graph'].find((n) => n['@type'] === 'Person') as Record<string, unknown>;
assert((fullPerson.sameAs as string[]).includes('https://www.linkedin.com/in/drkim'), 'person sameAs');
assert((fullPerson.alumniOf as { name?: string }).name === '서울대학교 의과대학', 'person alumniOf');
assert(JSON.stringify(fullPerson.knowsAbout) === JSON.stringify(['내과']), 'person knowsAbout compacted');
assert(Array.isArray(fullOrg.sameAs) && (fullOrg.sameAs as string[]).includes('https://blog.naver.com/seocho'), 'sameAs bound');
assert(fullOrg.hasOfferCatalog !== undefined && fullOrg.availableService !== undefined, 'dual catalog');
assert((fullOrg.hasOfferCatalog as { name: string }).name === '주요 서비스 및 진료 카탈로그', 'catalog title');
assert(fullOrg.taxID === '120-81-47521', 'taxID bound');
assert(fullOrg.faxNumber === '02-555-3434', 'fax bound');

const noSameAsOwnSite = buildStrictSchemaGraph({
	origin: 'https://clinic.example.com',
	sameAs: ['https://clinic.example.com/', 'https://example.com/about'],
});
assert(graphOrgNode(noSameAsOwnSite)?.sameAs === undefined, 'own-site / unofficial sameAs omitted');

console.log('test-strict-schema-graph: ok');
