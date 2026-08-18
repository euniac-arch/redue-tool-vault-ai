/**
 * Level 1–3 reach-mechanism guide metadata.
 * Run: npx tsx scripts/test-reach-level-guides.ts
 */
import {
	getReachLevelGuide,
	getReachLevelGuides,
	REACH_LEVEL_GUIDES,
	REACH_LEVELS,
} from '../lib/geo/reach-level-guides';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`, detail ?? '');
}

assert('exports Level 1–3', REACH_LEVELS.join(',') === '1,2,3');
assert('Record has three guides', Object.keys(REACH_LEVEL_GUIDES).length === 3);

for (const level of REACH_LEVELS) {
	const ko = getReachLevelGuide(level, 'ko');
	const en = getReachLevelGuide(level, 'en');
	assert(`L${level} ko level matches`, ko.level === level);
	assert(`L${level} en level matches`, en.level === level);
	assert(`L${level} ko has title`, ko.title.includes(`Level ${level}`));
	assert(`L${level} en has title`, en.title.includes(`Level ${level}`));
	assert(`L${level} ko has mechanism`, ko.reachMechanism.length > 20);
	assert(`L${level} en has mechanism`, en.reachMechanism.length > 20);
	assert(`L${level} ko has scope`, ko.exposureScope.length > 8);
	assert(`L${level} ko has pattern`, ko.examplePattern.includes('['));
}

const l1 = REACH_LEVEL_GUIDES[1];
const l2 = REACH_LEVEL_GUIDES[2];
const l3 = REACH_LEVEL_GUIDES[3];

assert('L1 is brand-only', l1.badgeText === '브랜드 전용' && l1.shortDesc.includes('상호'));
assert('L2 is category match', l2.badgeText === '카테고리 매칭' && l2.reachMechanism.includes('지역명'));
assert('L3 is GEO conversational', l3.badgeText.includes('GEO') && l3.reachMechanism.includes('상호가 전혀 없어도'));

const pack = getReachLevelGuides('en');
assert('en pack is independent', pack[1].badgeText === 'Brand only' && REACH_LEVEL_GUIDES[1].badgeText === '브랜드 전용');

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall reach-level guide checks passed');
