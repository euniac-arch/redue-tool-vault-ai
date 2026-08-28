/**
 * Universal sameAs extractor + channel-signal validator.
 * Run: npx tsx scripts/test-universal-same-as.ts
 */
import { detectEnginePlatformSignals } from '../lib/audit/engine-analysis';
import { extractEntitySameAsLinks } from '../lib/audit/extractors/geo-aeo-site-data';
import {
	extractUniversalSameAs,
	naverSameAsStatusMessage,
	validateChannelSignals,
} from '../lib/audit/extractors/universal-same-as';
import { computeExternalReputationFromSignals } from '../lib/audit/geo-score';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const yoastGraphHtml = `
<script type="application/ld+json" class="yoast-schema-graph">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalClinic",
      "name": "테스트의원",
      "sameAs": [
        "https://blog.naver.com/clinic",
        "https://place.naver.com/hospital/123"
      ]
    },
    {
      "@type": "Person",
      "name": "김원장",
      "sameAs": "https://www.instagram.com/clinic"
    }
  ]
}
</script>
`;

const gnuboardNested = `
<script type="application/ld+json">
{
  "@type": "Organization",
  "name": "그누보드병원",
  "founder": {
    "@type": "Person",
    "name": "이대표",
    "sameAs": ["https://m.blog.naver.com/founder"]
  },
  "parentOrganization": {
    "@type": "Organization",
    "sameAs": { "@id": "https://cafe.naver.com/clinic" }
  }
}
</script>
`;

const spaLocalBusiness = `
<script type="application/ld+json;charset=utf-8">
{
  "@type": ["LocalBusiness", "MedicalBusiness"],
  "sameAs": [
    "https://naver.me/xAbCd",
    "https://maps.app.goo.gl/abcd",
    "https://pf.kakao.com/_clinic",
    "https://kko.to/place1"
  ]
}
</script>
`;

const extracted = extractUniversalSameAs(yoastGraphHtml);
assert('yoast graph collects blog', extracted.some((u) => u.includes('blog.naver.com/clinic')));
assert('yoast graph collects place', extracted.some((u) => u.includes('place.naver.com/hospital/123')));
assert('yoast graph collects person instagram', extracted.some((u) => u.includes('instagram.com/clinic')));

const nested = extractUniversalSameAs(gnuboardNested);
assert('founder sameAs (m.blog)', nested.some((u) => /m\.blog\.naver\.com/i.test(u)));
assert('parentOrganization sameAs as @id', nested.some((u) => u.includes('cafe.naver.com/clinic')));

const spa = extractUniversalSameAs(spaLocalBusiness);
assert('naver.me short url', spa.some((u) => u.includes('naver.me')));
assert('google maps.app', spa.some((u) => u.includes('maps.app.goo.gl')));
assert('kakao channel', spa.some((u) => u.includes('pf.kakao.com')));
assert('kakao kko.to', spa.some((u) => u.includes('kko.to')));

const parsedNode = extractUniversalSameAs({
	'@type': 'Organization',
	sameAs: 'https://post.naver.com/viewer/postView.naver?volumeNo=1',
});
assert('parsed object sameAs string', parsedNode.some((u) => u.includes('post.naver.com')));

const extraMerged = extractUniversalSameAs('{"@type":"WebSite"}', ['https://blog.naver.com/extra']);
assert('extra sameAs merged', extraMerged.includes('https://blog.naver.com/extra'));

const channels = validateChannelSignals([
	'https://m.blog.naver.com/clinic',
	'https://map.naver.com/p/entry/place/999',
	'https://www.google.com/maps/place/Clinic',
	'https://map.kakao.com/123',
	'https://search.naver.com/search.naver?query=병원',
]);
assert('isNaverBlogLinked from m.blog', channels.isNaverBlogLinked === true);
assert('isNaverPlaceLinked from map.naver', channels.isNaverPlaceLinked === true);
assert('hasNaverChannel true when either present', channels.hasNaverChannel === true);
assert('google maps /maps path', channels.isGoogleMapsLinked === true);
assert('kakao map', channels.isKakaoLinked === true);
assert('search.naver.com is not a blog/place signal', !channels.naverBlogUrls.some((u) => u.includes('search.naver.com')));

const none = validateChannelSignals(['https://example.com/about']);
assert('no channel on generic site', none.hasNaverChannel === false && none.isGoogleMapsLinked === false);

const truncatedSnippet = `{
  "@context": "https://schema.org",
  "@type": "MedicalClinic",
  "name": "${'가'.repeat(80)}",
  "description": "${'설명'.repeat(200)}",
`;
const platformFromExtra = detectEnginePlatformSignals({
	schemaTypes: ['MedicalClinic'],
	jsonLdCorpus: `${truncatedSnippet}\n…`,
	sameAs: ['https://blog.naver.com/clinic', 'https://place.naver.com/hospital/1'],
});
assert('truncated snippet + sameAs extra → blog', platformFromExtra.naverBlogLinked === true);
assert('truncated snippet + sameAs extra → place', platformFromExtra.naverPlaceLinked === true);

const platformFromNested = detectEnginePlatformSignals({
	schemaTypes: ['Organization'],
	jsonLdCorpus: JSON.stringify({
		'@type': 'Organization',
		founder: { '@type': 'Person', sameAs: ['https://m.blog.naver.com/clinic'] },
	}),
});
assert('platform detects nested m.blog sameAs', platformFromNested.naverBlogLinked === true);

const hrefHtml = `
<footer><a href="https://blog.naver.com/ionlab">블로그</a></footer>
<script type="application/ld+json">
{"@type":"Organization","sameAs":["https://place.naver.com/hospital/9"]}
</script>
`;
const hrefSameAs = extractEntitySameAsLinks(hrefHtml);
assert('entity links keep footer blog', hrefSameAs.some((u) => u.includes('blog.naver.com/ionlab')));
assert('entity links keep schema place', hrefSameAs.some((u) => u.includes('place.naver.com/hospital/9')));

const linkedRep = computeExternalReputationFromSignals(
	{
		domain: 'clinic.example',
		technicalPct: 80,
		schemaPct: 80,
		geoPct: 70,
		orgPresent: true,
		orgComplete: true,
		faqPresent: true,
		aiBotsOk: true,
		keywords: ['피부'],
		platform: platformFromExtra,
		sameAs: ['https://blog.naver.com/clinic', 'https://place.naver.com/hospital/1'],
	},
	'ko',
);
assert(
	'linked report has no naverMentionIssue',
	linkedRep.digitalFootprint.naverMentionIssue == null,
	String(linkedRep.digitalFootprint.naverMentionIssue),
);
assert('linked flags blog', linkedRep.digitalFootprint.isNaverBlogLinked === true);
assert('linked flags place', linkedRep.digitalFootprint.isNaverPlaceLinked === true);
assert(
	'linked success copy',
	linkedRep.digitalFootprint.naverSameAsMessage === '공식 채널 sameAs 신호 연동 완료',
	linkedRep.digitalFootprint.naverSameAsMessage,
);

const missingRep = computeExternalReputationFromSignals(
	{
		domain: 'clinic.example',
		technicalPct: 40,
		schemaPct: 30,
		geoPct: 28,
		orgPresent: false,
		orgComplete: false,
		faqPresent: false,
		aiBotsOk: false,
		keywords: ['피부'],
		platform: detectEnginePlatformSignals({}),
	},
	'ko',
);
assert(
	'missing report warns',
	missingRep.digitalFootprint.naverMentionIssue ===
		'감사 페이지에서 네이버 플레이스·블로그 sameAs 신호가 확인되지 않았습니다.',
	missingRep.digitalFootprint.naverMentionIssue,
);
assert('missing flags false', missingRep.digitalFootprint.isNaverBlogLinked === false);
assert(
	'status helper linked',
	naverSameAsStatusMessage(true, 'ko') === '공식 채널 sameAs 신호 연동 완료',
);
assert(
	'status helper missing',
	naverSameAsStatusMessage(false, 'ko').includes('sameAs 신호가 확인되지 않았습니다'),
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall universal-same-as assertions passed');
