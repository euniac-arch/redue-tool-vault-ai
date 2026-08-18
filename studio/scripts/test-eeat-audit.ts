/**
 * E-E-A-T section: keywords, robots.txt bots, schema checklist, How-to.
 * Run: npx tsx scripts/test-eeat-audit.ts
 */
import {
	buildEeatAuditData,
	buildEeatPrimaryKeywords,
	buildIndustryHowtoGuides,
	buildMissingTargetKeyword,
	googleMentionBenchmarkFor,
	resolveEeatVertical,
} from '../lib/audit/eeat-audit';
import { parseAiBotAccessFromRobots } from '../lib/audit/robots-ai-bots';
import { computeExternalReputationFromSignals, extractSignalsFromReport, resolveExternalReputation } from '../lib/audit/geo-score';
import { detectEnginePlatformSignals } from '../lib/audit/engine-analysis';
import { buildAiCrawlerStatuses, buildSchemaPropertyChecks } from '../lib/geo/precision-diagnostics';
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

// —— 1. Keywords from specialties[0] + region, leftover 성형외과 dropped ——
const anseongKeywords = buildEeatPrimaryKeywords({
	specialties: ['스포츠재활', '아동발달센터', '성형외과'],
	primaryKeyword: '스포츠재활',
	category: '성형외과',
	broadLocation: '안성',
	brandName: '안성햇살의원',
	lang: 'ko',
});
assert(
	'anseong keywords bind specialties + region',
	anseongKeywords.includes('스포츠재활') && anseongKeywords.includes('아동발달센터') && anseongKeywords.includes('안성'),
	anseongKeywords.join(','),
);
assert('anseong keywords drop leftover 성형외과', !anseongKeywords.includes('성형외과'), anseongKeywords.join(','));
assert('anseong keywords drop brand name', !anseongKeywords.includes('안성햇살의원'), anseongKeywords.join(','));

const missing = buildMissingTargetKeyword({
	specialties: ['스포츠재활', '아동발달센터'],
	broadLocation: '안성',
	lang: 'ko',
});
assert('missing keyword is 안성 스포츠재활 후기', missing === '안성 스포츠재활 후기', missing);

const plasticOk = buildEeatPrimaryKeywords({
	specialties: ['성형외과', '눈성형'],
	broadLocation: '강남',
	lang: 'ko',
});
assert('on-page 성형외과 is kept when it is the real specialty', plasticOk.includes('성형외과'), plasticOk.join(','));
assert(
	'plastic missing keyword uses region + specialty',
	buildMissingTargetKeyword({ specialties: ['성형외과'], broadLocation: '강남', lang: 'ko' }) === '강남 성형외과 후기',
);

// —— 2. robots.txt 4-bot parse ——
const wildcardBlock = parseAiBotAccessFromRobots(`User-agent: *\nDisallow: /`);
assert('User-agent: * Disallow: / blocks GPTBot', wildcardBlock.gptbot === false);
assert('User-agent: * Disallow: / blocks PerplexityBot', wildcardBlock.perplexitybot === false);
assert('User-agent: * Disallow: / blocks ClaudeBot', wildcardBlock.claudebot === false);
assert('User-agent: * Disallow: / blocks Google-Extended', wildcardBlock['google-extended'] === false);

const specificBlock = parseAiBotAccessFromRobots(`
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: *
Allow: /
`);
assert('specific GPTBot Disallow: / blocks GPTBot', specificBlock.gptbot === false);
assert('specific ClaudeBot Disallow: / blocks ClaudeBot', specificBlock.claudebot === false);
assert('PerplexityBot falls back to * Allow', specificBlock.perplexitybot === true);
assert('Google-Extended falls back to * Allow', specificBlock['google-extended'] === true);

const allowOverride = parseAiBotAccessFromRobots(`
User-agent: *
Disallow: /
User-agent: GPTBot
Allow: /
`);
assert('specific GPTBot Allow wins over * Disallow', allowOverride.gptbot === true);
assert('* Disallow still blocks ClaudeBot', allowOverride.claudebot === false);

const adminOnly = parseAiBotAccessFromRobots(`
User-agent: GPTBot
Disallow: /admin
User-agent: PerplexityBot
Disallow: /wp-admin
`);
assert('Disallow: /admin does not count as site-wide GPTBot block', adminOnly.gptbot === true);
assert('Disallow: /wp-admin does not block PerplexityBot site-wide', adminOnly.perplexitybot === true);

const emptyRobots = parseAiBotAccessFromRobots('');
assert(
	'empty robots.txt allows all 4 bots',
	emptyRobots.gptbot && emptyRobots.perplexitybot && emptyRobots.claudebot && emptyRobots['google-extended'],
);

const mixedCase = parseAiBotAccessFromRobots(`User-agent: Google-Extended\nDisallow: /`);
assert('Google-Extended case-insensitive block', mixedCase['google-extended'] === false);
assert('other bots stay allowed when only Google-Extended is listed', mixedCase.gptbot === true);

const noMock = buildAiCrawlerStatuses({ lang: 'ko', aiBotsOk: false });
assert(
	'no per-bot map + aiBotsOk=false does not invent ClaudeBot-only block',
	noMock.every((bot) => bot.allowed === false),
	noMock.map((b) => `${b.id}:${b.allowed}`).join(','),
);

const liveMap = buildAiCrawlerStatuses({
	lang: 'ko',
	aiBotsOk: false,
	aiBotAccess: { gptbot: true, perplexitybot: false, claudebot: true, 'google-extended': false },
});
assert('live map: GPTBot allowed', liveMap.find((b) => b.id === 'gptbot')?.allowed === true);
assert('live map: PerplexityBot blocked', liveMap.find((b) => b.id === 'perplexitybot')?.allowed === false);
assert('live map: ClaudeBot allowed', liveMap.find((b) => b.id === 'claudebot')?.allowed === true);
assert('live map: Google-Extended blocked', liveMap.find((b) => b.id === 'google-extended')?.allowed === false);

// —— 3. Schema 5-property 1:1 from JSON-LD ——
const completeLd = JSON.stringify({
	'@type': 'MedicalClinic',
	telephone: '031-000-0000',
	address: { '@type': 'PostalAddress', streetAddress: '안성' },
	geo: { '@type': 'GeoCoordinates', latitude: 37.0, longitude: 127.2 },
	openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Monday' },
	hasOfferCatalog: { '@type': 'OfferCatalog', name: '스포츠재활' },
	availableService: { name: '도수치료' },
	sameAs: ['https://place.naver.com/hospital/1', 'https://blog.naver.com/clinic'],
});
const completeChecks = buildSchemaPropertyChecks({
	lang: 'ko',
	schemaTypes: ['MedicalClinic', 'GeoCoordinates', 'OpeningHoursSpecification', 'OfferCatalog'],
	jsonLdCorpus: completeLd,
	organizationMissing: [],
	orgComplete: true,
	industryType: 'MEDICAL',
	keyword: '스포츠재활',
});
assert('schema checklist has 5 items', completeChecks.length === 5);
assert(
	'complete JSON-LD marks all 5 valid',
	completeChecks.every((c) => c.complete),
	completeChecks.map((c) => `${c.id}:${c.complete}`).join(','),
);
assert('label @type', completeChecks[0].label === '@type', completeChecks[0].label);
assert('label geo', completeChecks[1].label === 'geo', completeChecks[1].label);
assert('label openingHoursSpecification', completeChecks[2].label === 'openingHoursSpecification', completeChecks[2].label);
assert('label hasOfferCatalog / availableService', completeChecks[3].label === 'hasOfferCatalog / availableService', completeChecks[3].label);
assert('label sameAs', completeChecks[4].label === 'sameAs', completeChecks[4].label);

const thinChecks = buildSchemaPropertyChecks({
	lang: 'ko',
	schemaTypes: ['WebSite'],
	jsonLdCorpus: '{"@type":"WebSite"}',
	organizationMissing: ['sameAs', 'logo'],
	orgComplete: false,
	industryType: 'MEDICAL',
	keyword: '스포츠재활',
});
assert('thin JSON-LD expects MedicalClinic @type', /MedicalClinic/.test(thinChecks[0].detail), thinChecks[0].detail);
assert('thin JSON-LD marks geo missing', thinChecks[1].complete === false);
assert('thin JSON-LD marks hours missing', thinChecks[2].complete === false);
assert('thin JSON-LD marks catalog missing', thinChecks[3].complete === false);
assert('thin JSON-LD marks sameAs missing', thinChecks[4].complete === false);

const availableOnly = buildSchemaPropertyChecks({
	lang: 'ko',
	schemaTypes: ['LocalBusiness'],
	jsonLdCorpus: '{"@type":"LocalBusiness","availableService":{"name":"상담"}}',
	orgComplete: false,
});
assert('availableService counts as offer catalog', availableOnly.find((c) => c.id === 'hasOfferCatalog')?.complete === true);

const legalChecks = buildSchemaPropertyChecks({
	lang: 'ko',
	schemaTypes: ['LegalService'],
	jsonLdCorpus: '{"@type":"LegalService"}',
	keyword: '법률 자문',
});
assert('LegalService is a valid @type', legalChecks[0].complete === true && legalChecks[0].detail.includes('LegalService'));

// —— 4. How-to industry copy (no 의료 연구소 dummy) ——
const medicalHowto = buildIndustryHowtoGuides({
	lang: 'ko',
	vertical: 'medical',
	schemaType: 'MedicalClinic',
	specialty: '스포츠재활',
	region: '안성',
	brandName: '안성햇살의원',
});
const legalHowto = buildIndustryHowtoGuides({
	lang: 'ko',
	vertical: 'legal',
	schemaType: 'LegalService',
	specialty: '법률 자문',
	region: '강남',
});
const localHowto = buildIndustryHowtoGuides({
	lang: 'ko',
	vertical: 'local',
	schemaType: 'LocalBusiness',
	specialty: '카페',
	region: '성수',
});
const howtoHay = JSON.stringify({ medicalHowto, legalHowto, localHowto });
assert('How-to never says 의료 연구소', !/의료 연구소/.test(howtoHay));
assert('medical How-to names 스포츠재활', medicalHowto.google.some((s) => s.body.includes('스포츠재활')));
assert('legal How-to names LegalService / 변호사', legalHowto.google.some((s) => /LegalService|변호사/.test(s.title + s.body)));
assert('local How-to names LocalBusiness or 상권', localHowto.google.some((s) => /LocalBusiness|상권/.test(s.title + s.body)));

assert('medical google benchmark is 220', googleMentionBenchmarkFor('medical') === 220);
assert('legal google benchmark is 180', googleMentionBenchmarkFor('legal') === 180);
assert('local google benchmark is 160', googleMentionBenchmarkFor('local') === 160);
assert('b2b google benchmark is 140', googleMentionBenchmarkFor('b2b') === 140);
assert('legal vertical from schema', resolveEeatVertical({ schemaTypes: ['LegalService'] }) === 'legal');

// —— 5. Full EeatAuditData + reputation resolver does not leak LLM 성형외과 ——
const anseongReport = {
	url: 'https://anseong-clinic.example.com',
	score: 40,
	maxScore: 100,
	schemaCoverage: 30,
	geoCitationScore: 28,
	scoreSource: 'live',
	siteMeta: {
		domain: 'anseong-clinic.example.com',
		brandName: '안성햇살의원',
		category: '스포츠재활',
		primaryKeyword: '스포츠재활',
		industryType: 'MEDICAL',
		location: '안성',
		broadLocation: '안성',
		vertical: 'medical',
		targetUrl: 'https://anseong-clinic.example.com',
		coreSpecialties: ['스포츠재활', '아동발달센터'],
		detectedKeywords: ['스포츠재활', '아동발달센터', '도수치료'],
	},
	metrics: {
		schemaTypes: ['WebSite'],
		jsonLdSnippets: ['{"@type":"WebSite"}'],
		organizationMissing: ['sameAs', 'logo'],
		aiBotAccess: { gptbot: true, perplexitybot: true, claudebot: false, 'google-extended': true },
	},
	checklist: [],
	categories: [],
} as unknown as AuditReport;

const signals = extractSignalsFromReport(anseongReport);
const computed = computeExternalReputationFromSignals(signals, 'ko');
assert(
	'computed keywords are specialties + region',
	computed.brandTrust.keywords.includes('스포츠재활') &&
		computed.brandTrust.keywords.includes('아동발달센터') &&
		computed.brandTrust.keywords.includes('안성'),
	computed.brandTrust.keywords.join(','),
);
assert('computed keywords have no 성형외과', !computed.brandTrust.keywords.includes('성형외과'));
assert(
	'computed missing keyword is 안성 스포츠재활 후기',
	computed.brandTrust.missingKeyword === '안성 스포츠재활 후기',
	computed.brandTrust.missingKeyword,
);
assert('NAP rate is crawl-derived (not 100)', computed.brandTrust.napMatchRate === 46, String(computed.brandTrust.napMatchRate));
assert('ClaudeBot blocked from live map', computed.digitalFootprint.aiBots?.find((b) => b.id === 'claudebot')?.allowed === false);
assert('GPTBot allowed from live map', computed.digitalFootprint.aiBots?.find((b) => b.id === 'gptbot')?.allowed === true);
assert('medical benchmark stays 220', computed.digitalFootprint.googleMentionBenchmark === 220);
assert('howtoGuides attached', Boolean(computed.digitalFootprint.howtoGuides?.google.length));
assert(
	'howtoGuides have no 의료 연구소',
	!JSON.stringify(computed.digitalFootprint.howtoGuides).includes('의료 연구소'),
);

const leaked = resolveExternalReputation(
	anseongReport,
	{
		externalReputation: {
			...computed,
			brandTrust: {
				...computed.brandTrust,
				keywords: ['성형외과', '강남'],
				missingKeyword: '성형외과 후기',
			},
		},
	},
	'ko',
);
assert(
	'resolver overwrites leftover LLM 성형외과 keywords',
	!leaked.brandTrust.keywords.includes('성형외과') && leaked.brandTrust.missingKeyword === '안성 스포츠재활 후기',
	`${leaked.brandTrust.keywords.join(',')} / ${leaked.brandTrust.missingKeyword}`,
);

const eeat = buildEeatAuditData({
	lang: 'ko',
	specialties: ['스포츠재활', '아동발달센터'],
	broadLocation: '안성',
	industryType: 'MEDICAL',
	schemaTypes: ['WebSite'],
	jsonLdCorpus: '{"@type":"WebSite"}',
	orgPresent: false,
	orgComplete: false,
	faqPresent: false,
	geoPct: 28,
	schemaPct: 30,
	aiBotAccess: { gptbot: true, perplexitybot: true, claudebot: false, 'google-extended': true },
});
assert('EeatAuditData.primaryKeywords match spec', eeat.data.primaryKeywords.join(',') === '스포츠재활,아동발달센터,안성');
assert('EeatAuditData.missingTargetKeyword match spec', eeat.data.missingTargetKeyword === '안성 스포츠재활 후기');
assert('EeatAuditData.personJobTitle is 대표원장', eeat.data.personJobTitle === '대표원장', eeat.data.personJobTitle);
assert(
	'EeatAuditData.personName falls back when footer has no name',
	eeat.data.personName === '미검출 (수동 입력 필요)',
	eeat.data.personName,
);
assert('EeatAuditData.recommendedSchemaType is MedicalClinic', eeat.data.recommendedSchemaType === 'MedicalClinic');
assert('EeatAuditData.botAccessibility.claudeBot is false', eeat.data.botAccessibility.claudeBot === false);
assert('EeatAuditData.schemaChecklist.entityType.valid is false', eeat.data.schemaChecklist.entityType.valid === false);
assert('EeatAuditData.digitalFootprint.googleBenchmarkAvg is 220', eeat.data.digitalFootprint.googleBenchmarkAvg === 220);

const strongPlatform = detectEnginePlatformSignals({
	schemaTypes: ['MedicalClinic', 'GeoCoordinates'],
	jsonLdCorpus: completeLd,
});
const strongEeat = buildEeatAuditData({
	lang: 'ko',
	specialties: ['스포츠재활'],
	broadLocation: '안성',
	industryType: 'MEDICAL',
	schemaTypes: ['MedicalClinic', 'GeoCoordinates', 'OpeningHoursSpecification', 'OfferCatalog'],
	jsonLdCorpus: completeLd,
	organizationMissing: [],
	orgPresent: true,
	orgComplete: true,
	faqPresent: true,
	geoPct: 80,
	schemaPct: 82,
	platform: strongPlatform,
	aiBotAccess: { gptbot: true, perplexitybot: true, claudebot: true, 'google-extended': true },
});
assert('complete schema entityType valid', strongEeat.data.schemaChecklist.entityType.valid);
assert('complete schema geo valid', strongEeat.data.schemaChecklist.geoCoordinates.valid);
assert('complete schema hours valid', strongEeat.data.schemaChecklist.openingHours.valid);
assert('complete schema catalog valid', strongEeat.data.schemaChecklist.offerCatalog.valid);
assert('complete schema sameAs valid', strongEeat.data.schemaChecklist.sameAs.valid);
assert('complete NAP is 94', strongEeat.data.napMatchRate === 94, String(strongEeat.data.napMatchRate));
assert('bingPlacesRegistered follows sameAs', strongEeat.data.digitalFootprint.bingPlacesRegistered === false);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall eeat-audit assertions passed');
