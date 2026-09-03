/**
 * Guards the AI 인텔리전스 control-bar + on-demand module contract:
 *   - No `/intelligence/*` sub-page may hardcode a literal default site.
 *   - Top-bar [AI 인텔리전스 분석] clears all module caches and diagnoses
 *     only the active tab — never a 10-job batch that times out serverless.
 *   - Opening another tab lazy-analyzes that module when cache misses or
 *     lastAnalyzedUrl !== targetUrl. Cached modules render without a refetch.
 *   - The shared top control bar starts with a truly blank URL field.
 *   - A one-time sessionStorage wipe (`resetStaleAsiSessionOnce`) clears stale
 *     `asi_*` keys from an older tab session.
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
	assert(`${file} does not auto-fetch on tab activate`, !src.includes('shouldLazyAnalyzeModule'));
}

const useAsiAnalysisSrc = read('lib/ai-search-intelligence/client/use-asi-analysis.ts');
assert('shared useAsiAnalysis hook (6 dashboards) subscribes to analyze requests', useAsiAnalysisSrc.includes('onAsiAnalyzeRequest('));
assert('shared useAsiAnalysis hook never auto-runs the mount-time seedUrl', !useAsiAnalysisSrc.includes('void analyze(seedUrl)'));
assert('shared useAsiAnalysis hook binds runs to currentSite', useAsiAnalysisSrc.includes('inputFromCurrentSite'));
assert('shared useAsiAnalysis hook does not lazy-analyze on mount', !useAsiAnalysisSrc.includes('shouldLazyAnalyzeModule'));

const layoutSrc = read('components/ai-search-intelligence/shell/AiIntelligenceLayout.tsx');
assert('layout wraps children with IntelligenceProvider', layoutSrc.includes('IntelligenceProvider'));
assert('layout renders the shared control bar', layoutSrc.includes('<AsiControlBar'));

const contextSrc = read('components/ai-search-intelligence/shell/IntelligenceContext.tsx');
assert('context surfaces recent audit history for the picker', contextSrc.includes('useAuditHistory'));
assert('context no longer broadcasts analyze to every dashboard', !contextSrc.includes('dispatchAsiAnalyzeRequest'));
assert('context exposes single-tool analysis', contextSrc.includes('runSingleToolAnalysis'));
assert('context exposes batch analysis', contextSrc.includes('runBatchToolAnalysis'));
assert('top-bar analysis clears module caches', contextSrc.includes('clearAsiToolSnapshots'));
assert('control bar URL field starts truly blank — no prefill from any storage', /useState<string>\(['"]{2}\)/.test(contextSrc));
assert('context no longer reads a bound-url prefill', !contextSrc.includes('readAsiBoundUrl'));
assert('context has no hardcoded default URL string literal', !/useState<string>\(\s*['"]https?:\/\//.test(contextSrc));
assert('context gates tool CTAs via requireTargetUrl', contextSrc.includes('requireTargetUrl'));
assert('context keeps a per-module status map', contextSrc.includes('createEmptyModules') && contextSrc.includes('globalAnalysisStatus'));
assert('context opens query intelligence from the hub', contextSrc.includes('ASI_DEFAULT_DETAIL_HREF') && contextSrc.includes('query-generator'));
assert(
	'context focuses the shared top-bar URL when a tool runs without a site',
	contextSrc.includes('focusSiteInput') && contextSrc.includes('ASI_NEED_SITE_MESSAGE'),
);

const chromeSrc = read('components/ai-search-intelligence/primitives/AsiPageChrome.tsx');
assert('page chrome no longer has a local URL input', !chromeSrc.includes('type="url"'));
assert('page chrome shows the shared target badge', chromeSrc.includes('AsiBoundTargetBadge'));
assert('page chrome has a per-tool analyze CTA', chromeSrc.includes('analyzeThisTool') && chromeSrc.includes('runSingleToolAnalysis'));
assert('page chrome waits for results or the tool CTA', chromeSrc.includes('waitingTitle') && chromeSrc.includes('isAnalyzed'));

const questionSrc = read('components/ai-search-intelligence/evidence/QuestionGeneratorPanel.tsx');
assert('question generator shows the shared target badge', questionSrc.includes('AsiBoundTargetBadge'));
assert('question generator generate/probe require the shared targetUrl', questionSrc.includes('requireTargetUrl()'));

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
