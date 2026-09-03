/**
 * Smart hashtag generation + schema/brand dedupe.
 * Run: npx tsx scripts/test-smart-hashtags.ts
 */
import { generateSmartHashtags, normalizeHashtagList } from '../lib/analysis/generateSmartHashtags';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`, detail ?? '');
}

const tags = generateSmartHashtags({
	brandName: '나인원의원',
	region: '대구 동구',
	industry: 'Dermatology',
	address: '대구광역시 동구 신천동 동부로 26길 6',
	coreFeatures: ['흉터 치료', '울트라클리어', '덴서티', '여드름 흉터'],
	extractedKeywords: ['Dermatology', 'PlasticSurgery', '나인원의원', '울트라클리어', 'MedicalClinic'],
});

assert('returns 8-10 tags', tags.length >= 8 && tags.length <= 10, tags);
assert(
	'all hashed',
	tags.every((tag) => tag.startsWith('#') && !tag.slice(1).includes('#')),
	tags,
);
assert('brand once', tags.filter((tag) => tag === '#나인원의원').length === 1, tags);
assert('has city industry hub', tags.includes('#대구피부과'), tags);
assert('has district hub', tags.includes('#대구동구피부과'), tags);
assert('has neighborhood hub', tags.includes('#대구신천동피부과'), tags);
assert('has feature city tag', tags.includes('#대구울트라클리어') || tags.includes('#울트라클리어'), tags);
assert(
	'drops schema english',
	!tags.some((tag) => /dermatology|plasticsurgery|medicalclinic/i.test(tag)),
	tags,
);

const dupes = normalizeHashtagList(['#나인원의원', '나인원의원', 'Dermatology', '대구피부과', '#대구피부과']);
assert('normalize drops brand dup + schema', dupes.join(',') === '#나인원의원,#대구피부과', dupes);

const emptyish = generateSmartHashtags({
	brandName: '',
	region: '',
	coreFeatures: [],
	extractedKeywords: ['null', 'undefined', 'Dermatology'],
});
assert('empty inputs yield no junk', emptyish.length === 0, emptyish);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
