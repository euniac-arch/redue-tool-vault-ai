/**
 * Live citation-path insight copy (cited vs not-cited) for Why & Status cards.
 * Run: npx tsx scripts/test-engine-insight.ts
 */
import {
	classifyCitationPath,
	getEngineInsight,
	hostnameFromUrl,
	isExternalCitationHost,
	type EngineInsightSignals,
} from '../lib/audit/engine-insight';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const httpSite: EngineInsightSignals = {
	isHttps: false,
	bingPlacesRegistered: false,
	googleMapsLinked: false,
	hasLlmsTxt: false,
	hasJsonLd: false,
	hasFaq: false,
	hasLocalBusiness: false,
	siteUrl: 'http://sky-clinic.com',
	recommendedSchemaType: 'MedicalClinic',
};

const httpsReady: EngineInsightSignals = {
	isHttps: true,
	bingPlacesRegistered: true,
	googleMapsLinked: true,
	hasLlmsTxt: true,
	hasJsonLd: true,
	hasFaq: true,
	hasLocalBusiness: true,
	siteUrl: 'https://sky-clinic.com',
	recommendedSchemaType: 'MedicalClinic',
};

const blogUrl = 'https://blog.naver.com/sky-review/223';
const officialUrl = 'https://sky-clinic.com/about';

assert('naver blog is external', isExternalCitationHost(hostnameFromUrl(blogUrl)));
assert('official host is not external', !isExternalCitationHost(hostnameFromUrl(officialUrl)));
assert('blog path is external', classifyCitationPath([blogUrl], httpSite.siteUrl) === 'external');
assert('official path is official', classifyCitationPath([officialUrl], httpsReady.siteUrl) === 'official');
assert(
	'mixed path',
	classifyCitationPath([officialUrl, blogUrl], httpsReady.siteUrl) === 'mixed',
);

const pplxExternal = getEngineInsight('perplexity', true, [blogUrl], httpSite, { liveScore: 80, lang: 'ko' });
assert('perplexity cited + blog uses footprint title', pplxExternal.reasonTitle.includes('외부 디지털 풋프린트'));
assert('perplexity cited keeps source tag', (pplxExternal.citedSources ?? []).includes(blogUrl));
assert('perplexity cited score uses liveScore', pplxExternal.score === 80);

const pplxOfficial = getEngineInsight('Perplexity', true, [officialUrl], httpsReady, { liveScore: 95, lang: 'ko' });
assert('perplexity cited + official domain title', pplxOfficial.reasonTitle.includes('공식 웹사이트 직접 인용'));
assert('perplexity official score', pplxOfficial.score === 95);

const claude = getEngineInsight('claude', true, [officialUrl], httpsReady, { liveScore: 80, lang: 'ko' });
assert('claude cited uses domain-entity title', claude.reasonTitle.includes('도메인-엔티티'));
assert('claude cited isCited true', claude.isCited);

const chatgptHttp = getEngineInsight('chatgpt', false, [], httpSite, { liveScore: 30, lang: 'ko' });
assert('chatgpt uncited HTTP mentions protocol', chatgptHttp.reasonDetails.some((d) => d.includes('HTTP')));
assert('chatgpt uncited HTTP mentions Bing', chatgptHttp.reasonDetails.some((d) => d.includes('Bing Places')));
assert('chatgpt uncited action includes HTTPS', chatgptHttp.actionRequired.includes('HTTPS'));
assert('chatgpt uncited isCited false', !chatgptHttp.isCited);

const chatgptHttps = getEngineInsight('chatgpt', false, [], { ...httpsReady, bingPlacesRegistered: false, hasLlmsTxt: false }, { lang: 'ko' });
assert('chatgpt HTTPS omits HTTP warning', !chatgptHttps.reasonDetails.some((d) => d.includes('비보안 프로토콜')));
assert('chatgpt HTTPS still flags Bing', chatgptHttps.reasonDetails.some((d) => d.includes('Bing Places')));

const geminiHttp = getEngineInsight('gemini', false, [], httpSite, { lang: 'ko' });
assert('gemini uncited mentions GBP', geminiHttp.reasonDetails.some((d) => d.includes('GBP') || d.includes('Knowledge Graph')));
assert('gemini uncited HTTP mentions HTTPS', geminiHttp.reasonDetails.some((d) => d.includes('HTTPS')));
assert('gemini uncited mentions MedicalClinic', geminiHttp.reasonDetails.some((d) => d.includes('MedicalClinic')));

const geminiHttps = getEngineInsight('gemini', false, [], { ...httpsReady, googleMapsLinked: false, hasLocalBusiness: false, hasJsonLd: false }, { lang: 'en' });
assert('gemini HTTPS omits HTTP penalty line', !geminiHttps.reasonDetails.some((d) => /HTTPS missing/i.test(d)));
assert('gemini EN title mentions GBP', /Google Business|GBP/i.test(geminiHttps.reasonTitle));

const chatgptCited = getEngineInsight('chatgpt', true, [officialUrl], httpsReady, { lang: 'ko' });
assert('chatgpt cited uses default success title', chatgptCited.reasonTitle.includes('공식 엔티티'));

const pplxMiss = getEngineInsight('perplexity', false, [], httpSite, { lang: 'ko' });
assert('perplexity uncited has first-party miss title', pplxMiss.reasonTitle.includes('1차 문서'));

const claudeMiss = getEngineInsight('claude', false, [], httpSite, { lang: 'ko' });
assert('claude uncited mentions entity match', claudeMiss.reasonTitle.includes('도메인-엔티티'));

if (failed > 0) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall engine-insight assertions passed');
