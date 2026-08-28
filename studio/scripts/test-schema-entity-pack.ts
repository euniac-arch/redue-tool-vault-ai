/**
 * Advanced schema entity pack — geo / hours / services / coverage fallbacks.
 * Run: npx tsx scripts/test-schema-entity-pack.ts
 */
import {
	SCHEMA_COVERAGE_FALLBACKS,
	WEEKDAY_PLUS_SATURDAY,
	buildAvailableServices,
	buildOpeningHoursSpecification,
	extractGeoFromMapScripts,
	filterOfficialSameAs,
	isOfficialChannelUrl,
	toSchemaGeoNode,
} from '../lib/audit/extractors/schema-entity-pack';
import { collectLocationCandidateUrls, isLocationMapPage } from '../lib/audit/extractors/representative-pages';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const kakao = extractGeoFromMapScripts('kakao.maps.LatLng(35.123456, 129.123456)');
assert('kakao LatLng', kakao?.latitude === 35.123456 && kakao.longitude === 129.123456, JSON.stringify(kakao));

const naver = extractGeoFromMapScripts('new naver.maps.Point(37.5172, 127.0473)');
assert('naver Point', naver?.latitude === 37.5172 && naver.longitude === 127.0473, JSON.stringify(naver));

const google = extractGeoFromMapScripts('https://www.google.com/maps/@35.1796,129.0756,17z');
assert('google @coord', google?.latitude === 35.1796 && google.longitude === 129.0756, JSON.stringify(google));

const hours = buildOpeningHoursSpecification({ opens: '09:00', closes: '19:00' });
assert('hours spec type', hours[0]['@type'] === 'OpeningHoursSpecification');
assert('hours include Saturday', hours[0].dayOfWeek.includes('Saturday'));
assert('hours weekday+sat length', hours[0].dayOfWeek.length === WEEKDAY_PLUS_SATURDAY.length);
assert('hours opens 09:00', hours[0].opens === '09:00');
assert('hours closes 19:00', hours[0].closes === '19:00');

const services = buildAvailableServices({
	industryType: 'MEDICAL',
	siteName: '테스트의원',
	navItems: [
		{ name: '내과진료', url: '/internal.php' },
		{ name: '외과진료', url: '/surgery.php' },
		{ name: '오시는길', url: '/location.php' },
		{ name: '공지사항', url: '/bbs/board.php?bo_table=notice' },
	],
	pages: [
		{ urlPath: '/dental.php', title: '치과', selected: true },
		{ urlPath: '/llms.txt', title: 'llms.txt', selected: true },
		{ urlPath: '/error.php', title: '상담', selected: false },
	],
});
assert('service type MedicalProcedure', services.every((s) => s['@type'] === 'MedicalProcedure'));
assert('keeps 내과진료', services.some((s) => s.name === '내과진료'));
assert('keeps 외과진료', services.some((s) => s.name === '외과진료'));
assert('keeps 치과', services.some((s) => s.name === '치과'));
assert('drops 오시는길', !services.some((s) => /오시는/.test(s.name)));
assert('drops 공지사항', !services.some((s) => s.name === '공지사항'));
assert('drops llms.txt', !services.some((s) => /llms/i.test(s.name)));
assert('drops unchecked 상담', !services.some((s) => s.name === '상담'));
assert('service keeps 내과 url', services.some((s) => s.name === '내과진료' && s.url === '/internal.php'));

const sameAs = filterOfficialSameAs(
	[
		'https://clinic.example.com/',
		'https://blog.naver.com/clinic',
		'https://cafe.naver.com/clinic',
		'https://www.instagram.com/clinic',
		'https://spam.example.net/page',
	],
	'https://clinic.example.com',
);
assert('sameAs keeps naver blog', sameAs.includes('https://blog.naver.com/clinic'));
assert('sameAs keeps naver cafe', sameAs.includes('https://cafe.naver.com/clinic'));
assert('sameAs keeps instagram', sameAs.includes('https://www.instagram.com/clinic'));
assert('sameAs drops own origin', !sameAs.some((u) => /clinic\.example\.com/.test(u)));
assert('sameAs drops unofficial host', !sameAs.some((u) => /spam\.example/.test(u)));

const geoNode = toSchemaGeoNode({ latitude: '35.1', longitude: '129.1' });
assert('geo node numbers', geoNode.latitude === 35.1 && geoNode.longitude === 129.1);
assert('fallbacks price', SCHEMA_COVERAGE_FALLBACKS.priceRange === '₩₩');
assert('fallbacks currency', SCHEMA_COVERAGE_FALLBACKS.currenciesAccepted === 'KRW');
assert('fallbacks payment', SCHEMA_COVERAGE_FALLBACKS.paymentAccepted === 'Cash, Credit Card');

assert('google maps is official', isOfficialChannelUrl('https://maps.google.com/?cid=1'));
assert('goo.gl maps is official', isOfficialChannelUrl('https://goo.gl/maps/abcd'));
assert('facebook is official', isOfficialChannelUrl('https://www.facebook.com/clinic'));
assert('kakao channel official', isOfficialChannelUrl('https://pf.kakao.com/_x'));
assert('naver cafe is official', isOfficialChannelUrl('https://cafe.naver.com/clinic'));
assert('naver post is official', isOfficialChannelUrl('https://post.naver.com/viewer/postView.naver?volumeNo=1'));
assert('linkedin is official', isOfficialChannelUrl('https://www.linkedin.com/in/drkim'));
assert('random site not official', isOfficialChannelUrl('https://example.com/about') === false);

assert('location.php is map page', isLocationMapPage('/location.php', '오시는길'));
const locUrls = collectLocationCandidateUrls({
	origin: 'https://clinic.example.com',
	collectedUrls: ['/intro.php', '/location.php'],
	navItems: [{ name: '오시는길', url: '/map.php' }],
});
assert('collect location.php', locUrls.some((u) => /location\.php/.test(u)));
assert('collect map from nav', locUrls.some((u) => /map\.php/.test(u)));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall schema-entity-pack assertions passed');
