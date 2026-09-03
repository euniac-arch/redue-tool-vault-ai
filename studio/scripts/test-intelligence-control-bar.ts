/**
 * Guards the "zero automatic analysis, ever" contract for AI 인텔리전스:
 *   - No `/intelligence/*` sub-page (or its state/store/mock data) may
 *     hardcode a literal default site anywhere in the ASI feature tree.
 *   - A page mount may ONLY EVER restore an already-computed cached result
 *     for that exact tool (zero network calls) — it may NEVER call a loader
 *     function on its own, no matter what URL happens to be bound/seeded/
 *     cached from a prior action. The user must press this page's own
 *     Analyze/Generate button, or the shared top bar's [AI 인텔리전스 분석]
 *     button, every single time, on every single page.
 *   - The shared top control bar (`AsiControlBar` + `IntelligenceContext`)
 *     starts with a truly blank URL field — no prefill from any storage.
 *   - A one-time sessionStorage wipe (`resetStaleAsiSessionOnce`) clears any
 *     `asi_*` keys left over from a browser tab that was open before this
 *     fix shipped, so a stale bound URL / snapshot cache from earlier
 *     testing can never reappear and look like a hardcoded default.
 * Run: npx tsx scripts/test-intelligence-control-bar.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function read(rel: string) {
	return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) walk(full, out);
		else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
	}
	return out;
}

// 1. No hardcoded demo/client domain anywhere under the ASI feature tree
//    (components, lib, or the App Router pages themselves).
const asiDirs = [
	resolve(process.cwd(), 'app/intelligence'),
	resolve(process.cwd(), 'components/ai-search-intelligence'),
	resolve(process.cwd(), 'lib/ai-search-intelligence'),
];
const bannedDomainPattern = /nineoneclinic|나인원의원/i;
const offenders: string[] = [];
for (const dir of asiDirs) {
	for (const file of walk(dir)) {
		if (bannedDomainPattern.test(read(file))) offenders.push(file);
	}
}
assert('no hardcoded demo domain anywhere under the ASI feature tree', offenders.length === 0, offenders.join(', '));

// 2. Session hygiene: a stale tab can never resurrect an old bound URL/cache.
const boundUrlSrc = read('lib/ai-search-intelligence/asi-bound-url.ts');
assert('module wipes stale asi_* sessionStorage once per tab on load', boundUrlSrc.includes('resetStaleAsiSessionOnce()'));
assert(
	'seedAsiSiteUrl no longer blindly falls back to the last full SEO audit',
	!/seedAsiSiteUrl[\s\S]*?loadLatestAuditPayload/.test(boundUrlSrc.slice(0, boundUrlSrc.indexOf('export function writeAsiBoundUrl'))),
);
assert('asi-bound-url exposes the analyze-request bridge', boundUrlSrc.includes('dispatchAsiAnalyzeRequest') && boundUrlSrc.includes('onAsiAnalyzeRequest'));

// 3. Every bespoke dashboard's fetch call must use the *normalized* URL from
//    the user-triggered analyze path, never the raw mount-time `seedUrl` —
//    that exact fingerprint (`{ url: seedUrl` fed straight into a loader) is
//    what the old auto-fetch-on-mount code looked like, so its absence is a
//    reliable signal the mount effect can no longer trigger a fetch itself.
const bespokeAutoFetchFingerprints: Array<{ file: string; fingerprints: string[] }> = [
	{
		file: 'components/ai-search-intelligence/war-room/WarRoomDashboard.tsx',
		fingerprints: ['loadAsiWarRoom({ url: seedUrl'],
	},
	{
		file: 'components/ai-search-intelligence/perception/PerceptionDashboard.tsx',
		fingerprints: ['loadAsiPerception({ url: seedUrl'],
	},
	{
		file: 'components/ai-search-intelligence/evidence/EvidenceDashboard.tsx',
		fingerprints: ['loadAsiEvidence({ url: seedUrl'],
	},
	{
		file: 'components/ai-search-intelligence/recommendation/RecommendationDashboard.tsx',
		fingerprints: ['loadSnapshot({ url: seedUrl }'],
	},
];

for (const { file, fingerprints } of bespokeAutoFetchFingerprints) {
	const src = read(file);
	for (const fingerprint of fingerprints) {
		assert(`${file} no longer feeds the mount-time seedUrl straight into a loader`, !src.includes(fingerprint));
	}
	assert(`${file} does not inline the last-audit auto-run fallback`, !src.includes('loadLatestAuditPayload()?.report.url'));
	assert(`${file} subscribes to the shared top-bar analyze request`, src.includes('onAsiAnalyzeRequest('));
	assert(`${file} mount effect is documented as a restore-only, no-auto-fetch path`, src.includes('ONLY ever restore an already-computed result'));
}

const useAsiAnalysisSrc = read('lib/ai-search-intelligence/client/use-asi-analysis.ts');
assert('shared useAsiAnalysis hook (6 dashboards) subscribes to analyze requests', useAsiAnalysisSrc.includes('onAsiAnalyzeRequest('));
assert('shared useAsiAnalysis hook mount effect never calls analyze() on its own', !useAsiAnalysisSrc.includes('void analyze(seedUrl)'));

const layoutSrc = read('components/ai-search-intelligence/shell/AiIntelligenceLayout.tsx');
assert('layout wraps children with IntelligenceProvider', layoutSrc.includes('IntelligenceProvider'));
assert('layout renders the shared control bar', layoutSrc.includes('<AsiControlBar'));

const contextSrc = read('components/ai-search-intelligence/shell/IntelligenceContext.tsx');
assert('context surfaces recent audit history for the picker', contextSrc.includes('useAuditHistory'));
assert('context dispatches the explicit analyze request', contextSrc.includes('dispatchAsiAnalyzeRequest'));
assert('control bar URL field starts truly blank — no prefill from any storage', /useState<string>\(['"]{2}\)/.test(contextSrc));
assert('context no longer reads a bound-url prefill', !contextSrc.includes('readAsiBoundUrl'));
assert('context has no hardcoded default URL string literal', !/useState<string>\(\s*['"]https?:\/\//.test(contextSrc));

const controlBarSrc = read('components/ai-search-intelligence/shell/AsiControlBar.tsx');
assert('control bar has a URL input', controlBarSrc.includes("type=\"url\""));
assert(
	'control bar has a custom history picker',
	controlBarSrc.includes('aria-haspopup="listbox"') && controlBarSrc.includes('AsiHistoryDropdown'),
);
assert('control bar no longer uses a native select', !controlBarSrc.includes('<select'));
assert('control bar submits via requestAnalysis', controlBarSrc.includes('requestAnalysis('));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
