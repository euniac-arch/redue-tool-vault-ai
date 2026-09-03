/**
 * War Room mock snapshot contract.
 * Run: npx tsx scripts/test-intelligence-war-room.ts
 */
import { clearAsiCitationStore } from '../lib/ai-search-intelligence/citations/store';
import { buildMockWarRoomSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-war-room';
import { normalizeAsiSiteUrl } from '../lib/ai-search-intelligence/normalize-site-url';
import { clearAsiVisibilityStore } from '../lib/ai-search-intelligence/visibility/store';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

clearAsiCitationStore();
clearAsiVisibilityStore();

assert('rejects empty url', normalizeAsiSiteUrl(' ') === null);
assert('adds https', normalizeAsiSiteUrl('sunshineclinic.kr') === 'https://sunshineclinic.kr');
assert('strips www', normalizeAsiSiteUrl('https://www.SunshineClinic.kr/') === 'https://sunshineclinic.kr');

const first = buildMockWarRoomSnapshot({ url: 'https://sunshineclinic.kr' });
const again = buildMockWarRoomSnapshot({ url: 'https://www.sunshineclinic.kr' });
assert('builds snapshot', Boolean(first));
assert('loop is attached', Boolean(first?.loop));
assert('health current is 0-100', (first?.loop?.health.current ?? -1) >= 0 && (first?.loop?.health.current ?? 101) <= 100);
assert('empty stores invent no loop tops', (first?.loop?.opportunities.length ?? 1) === 0 && (first?.loop?.gaps.length ?? 1) === 0 && (first?.loop?.actions.length ?? 1) === 0);
assert('empty stores invent no loop alerts', (first?.loop?.alerts.length ?? 1) === 0);
assert('four engines', first?.visibility.engines.length === 4);
assert('deterministic host', first?.visibility.overall === again?.visibility.overall);
assert('blockers 3-5', (first?.blockers.length ?? 0) >= 3 && (first?.blockers.length ?? 0) <= 5);
assert('mock competitors stay empty until live answers', (first?.competitors.length ?? 1) === 0);
assert('mock competitor state is NO_DATA', first?.observationState === 'NO_DATA');
assert('has queries', (first?.queries.length ?? 0) >= 3);
assert('has citations', (first?.citations.length ?? 0) >= 2);
assert('kpis in range', (first?.kpis.shareOfVoice ?? -1) >= 0 && (first?.kpis.shareOfVoice ?? 101) <= 100);
assert('rejects bad host', buildMockWarRoomSnapshot({ url: 'not-a-url' }) === null);

const other = buildMockWarRoomSnapshot({ url: 'https://other-clinic.co.kr' });
assert('different host can differ', first?.visibility.overall !== other?.visibility.overall || first?.kpis.trustScore !== other?.kpis.trustScore);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
