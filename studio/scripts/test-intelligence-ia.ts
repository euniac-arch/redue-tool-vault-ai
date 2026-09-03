/**
 * STEP 8 — thinking-flow IA. 16 tools stay unique; Alert is not a 17th page.
 * Run: npx tsx scripts/test-intelligence-ia.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveIntelligenceTool } from '../constants/aiIntelligenceTools';
import { composeAsiIaContext } from '../lib/ai-search-intelligence/ia/context';
import {
	ASI_FEATURES,
	ASI_PILLARS,
	asiIaEntries,
	entryHash,
	isAsiIaEntryActive,
	resolveAsiRoute,
} from '../lib/ai-search-intelligence/routes';

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

assert('six thinking groups', ASI_PILLARS.map((group) => group.id).join() === 'discover,measure,explain,compete,act,monitor');
assert('sixteen unique tools', ASI_FEATURES.length === 16 && new Set(ASI_FEATURES.map((tool) => tool.slug)).size === 16);
assert(
	'discover = query + opportunity + simulator',
	ASI_PILLARS[0].tools.map((tool) => tool.id).join() === 'questions,opportunity,simulator',
);
assert(
	'measure = visibility + brand + sov + test',
	ASI_PILLARS[1].tools.map((tool) => tool.id).join() === 'visibility,brand,sov,test',
);
assert(
	'explain = explorer + citations + reputation',
	ASI_PILLARS[2].tools.map((tool) => tool.id).join() === 'explorer,citations,reputation',
);
assert('compete = competitors + gap', ASI_PILLARS[3].tools.map((tool) => tool.id).join() === 'competitors,gap');
assert(
	'act = action + readiness + snapshot',
	ASI_PILLARS[4].tools.map((tool) => tool.id).join() === 'action,agent-readiness,snapshot',
);
assert('monitor unique tool is war-room only', ASI_PILLARS[5].tools.map((tool) => tool.id).join() === 'war-room');

const monitorEntries = asiIaEntries(ASI_PILLARS[5]);
assert('monitor shows Visibility Monitor + Alert + War Room', monitorEntries.map((row) => row.id).join() === 'visibility-trend,alert,war-room');
assert('alert is a hash, not a new slug', monitorEntries.find((row) => row.id === 'alert')?.href.endsWith('#asi-alerts') === true);
assert('no 17th feature slug', !ASI_FEATURES.some((tool) => tool.slug === 'ai-alert'));

const allEntries = ASI_PILLARS.flatMap(asiIaEntries);
assert('menus are grouped slots, not a 16-row list', allEntries.length === 18, String(allEntries.length));
assert('unique destinations = 16 slugs + 2 monitor hashes', new Set(allEntries.map((row) => row.href)).size === 18);
assert('entry hashes only on monitor extras', allEntries.filter((row) => entryHash(row.href)).length === 2);

assert('visibility score is MEASURE, not a second page', isAsiIaEntryActive(asiIaEntries(ASI_PILLARS[1])[0], '/intelligence/visibility-monitor', ''));
assert(
	'trend hash activates Visibility Monitor entry',
	isAsiIaEntryActive(monitorEntries[0], '/intelligence/visibility-monitor', '#asi-trend'),
);
assert(
	'alert hash activates AI Alert',
	isAsiIaEntryActive(monitorEntries[1], '/intelligence/visibility-monitor', '#asi-alerts'),
);

assert('query-generator still canonical', resolveAsiRoute(['query-generator']).tool.id === 'questions' && !resolveAsiRoute(['query-generator']).redirectTo);
assert('legacy perception still brand', resolveAsiRoute(['perception']).tool.id === 'brand');

const empty = composeAsiIaContext();
assert('empty session invents no scores', Object.values(empty).every((row) => row.score == null && row.status === 'empty'));
assert('empty session still points to a real action', Object.values(empty).every((row) => row.actionHref.startsWith('/intelligence')));

const contextSrc = read('lib/ai-search-intelligence/ia/context.ts');
assert('IA context does not query providers', !contextSrc.includes('queryAsiProviders'));
assert(
	'IA context has no vendor HTTP',
	!/api\.openai\.com|generativelanguage\.googleapis\.com|api\.perplexity\.ai|api\.anthropic\.com/.test(contextSrc),
);
assert('IA context reads session only', contextSrc.includes('readAsiSessionSnapshot'));

const layout = read('components/ai-search-intelligence/shell/AiIntelligenceLayout.tsx');
assert('layout mounts grouped IA nav', layout.includes('AsiIaNav'));
assert('layout dropped the 16-tool strip', !layout.includes('AsiToolNav') && !layout.includes('AsiPillarNav'));

const iaNav = read('components/ai-search-intelligence/shell/AsiIaNav.tsx');
assert('IA cards expose status', iaNav.includes("t(`status.${status}`)"));
assert('IA cards expose score', iaNav.includes('ctx?.score'));
assert('IA cards wait until global analysis', iaNav.includes("t('ia.wait')") && iaNav.includes("t('ia.viewDetail')") && iaNav.includes("t('ia.diagnosing')"));
assert('IA cards can reanalyze a single tool', iaNav.includes('reanalyzeTool') && iaNav.includes("t('ia.reanalyze')"));
assert('IA cards bind catalog titleKo', iaNav.includes('titleKo') && iaNav.includes('getIntelligenceToolByEntryId'));
assert('IA category badges are bilingual', iaNav.includes('AsiCategoryBadge'));

const catalog = read('constants/aiIntelligenceTools.ts');
assert('catalog is the title SSOT', catalog.includes('AI_INTELLIGENCE_TOOLS') && catalog.includes('AI 질문 인텔리전스') && catalog.includes('AI Query Intelligence'));
assert('query intelligence maps to questions entry', catalog.includes("entryId: 'questions'") && catalog.includes("id: 'query-intelligence'"));

const chrome = read('components/ai-search-intelligence/primitives/AsiPageChrome.tsx');
assert('detail chrome binds catalog titles', chrome.includes('useActiveIntelligenceTool') && chrome.includes('tool.titleKo') && chrome.includes('tool.titleEn'));
assert('detail chrome binds catalog category', chrome.includes('tool.categoryKo') && chrome.includes('tool.categoryEn'));

assert(
	'query-generator detail title is AI Query Intelligence, not Evidence',
	resolveIntelligenceTool('/intelligence/query-generator').titleKo === 'AI 질문 인텔리전스' &&
		resolveIntelligenceTool('/intelligence/query-generator').titleEn === 'AI Query Intelligence',
);
assert(
	'query-generator category is DISCOVER',
	resolveIntelligenceTool('/intelligence/query-generator').categoryKo === '발견' &&
		resolveIntelligenceTool('/intelligence/query-generator').categoryEn === 'DISCOVER',
);

const header = read('components/Header.tsx');
assert('GNB no longer uses the wide grouped Intelligence mega-menu', !header.includes('AsiGnbDropdown'));

const publicNav = read('lib/nav/public-nav.ts');
assert(
	'AI Intelligence GNB is a compact 6-item vertical list',
	publicNav.includes('AI_INTELLIGENCE_GNB_MENUS') && (publicNav.match(/key: 'asiGnb[A-Za-z]+'/g)?.length ?? 0) === 6,
);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
