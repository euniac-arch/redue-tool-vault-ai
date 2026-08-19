/**
 * GEO/AEO site-data extractor (representative hours, geo, sameAs, specialty).
 * Run: npx tsx scripts/test-geo-aeo-site-data.ts
 */
import {
	DEFAULT_CLOSES,
	DEFAULT_OPENS,
	DEFAULT_SEOCHO_GEO,
	extractEntitySameAsLinks,
	extractGeoAeoSiteData,
	extractOpeningHours,
	geocodeFromAddress,
	mapMedicalSpecialties,
} from '../lib/audit/extractors/geo-aeo-site-data';
import { extractSiteMetadata } from '../lib/audit/site-metadata';
import * as cheerio from 'cheerio';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const hours = extractOpeningHours('진료시간 평일 09:30 ~ 17:30 토요일 09:00 - 13:00');
assert('weekday opens 09:30', hours.opens === '09:30', hours.opens);
assert('weekday closes 17:30', hours.closes === '17:30', hours.closes);
assert('weekend opens detected', hours.weekendOpens === '09:00', hours.weekendOpens);
assert('hours detected flag', hours.detected === true);

const fallbackHours = extractOpeningHours('주소: 서울특별시 서초구');
assert('default opens 09:00', fallbackHours.opens === DEFAULT_OPENS);
assert('default closes 18:00', fallbackHours.closes === DEFAULT_CLOSES);
assert('default not detected', fallbackHours.detected === false);

const seocho = geocodeFromAddress('서울특별시 서초구 강남대로 123');
assert('seocho latitude', seocho.latitude === DEFAULT_SEOCHO_GEO.latitude, seocho.latitude);
assert('seocho longitude', seocho.longitude === DEFAULT_SEOCHO_GEO.longitude, seocho.longitude);
assert('seocho locality source', seocho.source === 'locality');

const busan = geocodeFromAddress('부산광역시 해운대구 센텀');
assert('busan locality geo', busan.source === 'locality' && busan.latitude === '35.1796');

const html = `
<footer>
  대표원장 : 김중입
  주소 : 서울특별시 서초구 서초대로 396 (우편번호 06605)
  상담시간 평일 09:00 ~ 18:00
  <a href="https://map.naver.com/p/entry/place/12345">네이버 지도</a>
  <a href="https://place.map.kakao.com/678">카카오맵</a>
  <a href="https://www.instagram.com/ionlab">인스타</a>
  <a href="https://blog.naver.com/ionlab">블로그</a>
</footer>
<title>중입자 암치료 연구소</title>
`;
const sameAs = extractEntitySameAsLinks(html);
assert('collects naver map', sameAs.some((u) => u.includes('map.naver.com')));
assert('collects kakao place', sameAs.some((u) => u.includes('place.map.kakao.com')));
assert('collects instagram', sameAs.some((u) => u.includes('instagram.com')));
assert('collects naver blog', sameAs.some((u) => u.includes('blog.naver.com')));

const specialties = mapMedicalSpecialties(['중입자치료', '암'], 'MEDICAL');
assert('oncologic mapped', specialties.includes('Oncologic'));
assert('radiation mapped', specialties.includes('RadiationTherapy'));

const $ = cheerio.load(html);
const site = extractSiteMetadata($, 'https://koreaionlab.co.kr/', 'ko', html);
assert('siteData opening hours bound', site.openingHours?.opens === '09:00', site.openingHours?.opens);
assert('siteData geo seocho', site.geo?.latitude === DEFAULT_SEOCHO_GEO.latitude);
assert('siteData sameAs bound', (site.sameAs || []).length >= 3, String(site.sameAs?.length));
assert('siteData medical specialty', (site.medicalSpecialty || []).includes('Oncologic'));
assert('siteData accepting default true', site.isAcceptingNewPatients === true);
assert('siteData postal', site.postalCode === '06605', site.postalCode);

const jsonLdHtml = `<script type="application/ld+json">{"@type":"MedicalClinic","geo":{"@type":"GeoCoordinates","latitude":"37.5","longitude":"127.1"}}</script>`;
const fromLd = extractGeoAeoSiteData({ html: jsonLdHtml, industryType: 'MEDICAL' });
assert('jsonld geo source', fromLd.geo.source === 'jsonld' && fromLd.geo.latitude === '37.5');

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nOK geo-aeo site-data extractor');
