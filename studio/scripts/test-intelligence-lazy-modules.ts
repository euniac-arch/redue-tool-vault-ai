/**
 * Two-track AI Intelligence analysis:
 * Track A = sequential 16-tool batch from currentSite
 * Track B = single tool from currentSite only
 * Run: npx tsx scripts/test-intelligence-lazy-modules.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveAsiOperation } from '../lib/ai-search-intelligence/api/operations';
import { inputFromCurrentSite } from '../lib/ai-search-intelligence/client/current-site-input';
import {
	BATCH_TOOL_TOTAL,
	BATCH_UNIQUE_ENTRIES,
	jobForEntry,
	toolsCompletedByEntry,
} from '../lib/ai-search-intelligence/client/run-global-analysis';
import { hrefForIaEntry, iaEntryIdFromPath } from '../lib/ai-search-intelligence/routes';
import type { AsiTargetContext } from '../lib/ai-search-intelligence/target/client';

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

const site: AsiTargetContext = {
	siteUrl: 'https://harborinn.example/',
	brandName: 'Harbor Inn',
	domain: 'harborinn.example',
	location: '제주',
	industry: '호텔',
	services: ['오션뷰'],
	targetAudience: '여행객',
	keywords: ['호텔'],
	aliases: ['Harbor Inn'],
	boundFromAudit: false,
};

const input = inputFromCurrentSite(site);
assert('currentSite input uses siteUrl only', input.url === 'https://harborinn.example/');
assert('currentSite input copies industry', input.questions?.industry === '호텔');
assert('currentSite input copies target', input.questions?.target === '여행객');
assert('currentSite input copies service', input.questions?.service === '오션뷰');

assert('batch covers 16 tools', BATCH_TOOL_TOTAL === 16);
assert(
	'unique batch loaders sum to 16 tools',
	BATCH_UNIQUE_ENTRIES.reduce((sum, id) => sum + toolsCompletedByEntry(id).length, 0) === 16,
);
assert('questions job is evidence', jobForEntry('questions') === 'evidence');
assert('query-generator path is questions', iaEntryIdFromPath('/intelligence/query-generator') === 'questions');
assert('questions href is query-generator', hrefForIaEntry('questions').includes('query-generator'));
assert('moduleType questions resolves', resolveAsiOperation('questions') === 'query-generator');

const contextSrc = read('components/ai-search-intelligence/shell/IntelligenceContext.tsx');
assert('requestAnalysis starts a sequential batch', contextSrc.includes('runBatchToolAnalysis'));
assert('single-tool runner requires currentSite', contextSrc.includes('runSingleToolAnalysis') && contextSrc.includes('currentSiteRef'));
assert('requestAnalysis resets module caches', contextSrc.includes('clearAsiToolSnapshots()') && contextSrc.includes('createEmptyModules()'));

const navSrc = read('components/ai-search-intelligence/shell/AsiIaNav.tsx');
assert('IA cards stay navigable while another module loads', navSrc.includes('hasTarget ?') && navSrc.includes('<Link'));
assert('IA cards do not lock all tools on global analyzing', !navSrc.includes("globalAnalysisStatus === 'analyzing'"));

const chromeSrc = read('components/ai-search-intelligence/primitives/AsiPageChrome.tsx');
assert('chrome exposes per-tool analyze', chromeSrc.includes('analyzeThisTool') && chromeSrc.includes('refreshTool'));
assert('chrome does not render a URL input', !chromeSrc.includes('type="url"'));

const batchSrc = read('lib/ai-search-intelligence/client/run-global-analysis.ts');
assert('batch runner is sequential', batchSrc.includes('for (const entryId of BATCH_UNIQUE_ENTRIES)'));
assert('single-entry runner maps questions to query-generator', batchSrc.includes("case 'questions':") && batchSrc.includes('loadAsiQueryGenerator'));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
