/**
 * STEP 19-C — FREE / MEMBER / PRO / ADMIN API + lock-CTA + page-gate audit.
 * Does not print secrets. Run: npx tsx scripts/test-intelligence-entitlement-e2e.ts
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GET, POST } from '../app/api/intelligence/route';
import { ASI_OPERATIONS } from '../lib/ai-search-intelligence/api/operations';
import { authorizeAsiRequest, ASI_HARD_PRO_OPERATIONS } from '../lib/ai-search-intelligence/entitlement/authorize';
import { canAccessFeature } from '../lib/ai-search-intelligence/entitlement/can-access';
import { ASI_OPERATION_FEATURE } from '../lib/ai-search-intelligence/entitlement/catalog';
import { actorFromTier } from '../lib/ai-search-intelligence/entitlement/actor-model';
import { asiFeatureForTool } from '../lib/ai-search-intelligence/entitlement/feature-for-tool';
import { resolveAsiLockIntent, asiHrefForFeature } from '../lib/ai-search-intelligence/entitlement/lock-cta';
import { clearAsiGuestRuns } from '../lib/ai-search-intelligence/entitlement/quota';
import { clearAsiAccountUsage } from '../lib/ai-search-intelligence/guard/account-usage';
import { resolveAsiMode } from '../lib/ai-search-intelligence/providers/resolve-mode';
import type { AsiToolId } from '../lib/ai-search-intelligence/routes';

const URL = 'https://sunshineclinic.kr';
const TIERS = ['guest', 'member', 'pro', 'admin'] as const;
const HARD = new Set<string>(ASI_HARD_PRO_OPERATIONS);

function walk(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '.next') continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|tsx)$/.test(name)) out.push(full);
	}
	return out;
}

function post(body: unknown, headers: Record<string, string> = {}) {
	return POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify(body),
		}),
	);
}

function postAs(tier: (typeof TIERS)[number], body: unknown, extra: Record<string, string> = {}) {
	const headers: Record<string, string> = { 'x-forwarded-for': `198.51.100.${TIERS.indexOf(tier) + 10}`, ...extra };
	if (tier !== 'guest') headers['x-asi-test-tier'] = tier;
	return post(body, headers);
}

async function statusOf(tier: (typeof TIERS)[number], operation: string) {
	clearAsiGuestRuns();
	clearAsiAccountUsage();
	const res = await postAs(tier, { operation, url: URL });
	const body = (await res.json()) as { success?: boolean; error?: { code?: string } };
	return { status: res.status, code: body.error?.code || (body.success ? 'ok' : 'unknown') };
}

const PAGE_GATES: Array<{ tool: AsiToolId; slug: string; gatedInView: boolean; note: string }> = [
	{ tool: 'war-room', slug: 'war-room', gatedInView: false, note: 'dashboard internal lock, not AsiEntitlementGate' },
	{ tool: 'opportunity', slug: 'opportunity-finder', gatedInView: false, note: 'teaser page + clip banner' },
	{ tool: 'explorer', slug: 'evidence-explorer', gatedInView: false, note: 'teaser page + clip banner' },
	{ tool: 'gap', slug: 'competitor-gap', gatedInView: true, note: 'AsiEntitlementGate competitor.gap' },
	{ tool: 'action', slug: 'next-best-action', gatedInView: true, note: 'AsiEntitlementGate next-best-action' },
	{ tool: 'brand', slug: 'brand-perception', gatedInView: false, note: 'diagnose open' },
	{ tool: 'sov', slug: 'share-of-voice', gatedInView: true, note: 'AsiEntitlementGate sov' },
	{ tool: 'competitors', slug: 'competitor-analysis', gatedInView: true, note: 'Gate yes, UI fetch is recommendation-test' },
	{ tool: 'visibility', slug: 'visibility-monitor', gatedInView: false, note: 'API teaser + board lock for full/alert' },
	{ tool: 'citations', slug: 'citation-explorer', gatedInView: false, note: 'teaser + clip' },
	{ tool: 'agent-readiness', slug: 'agent-readiness', gatedInView: false, note: 'diagnose open' },
];

void (async () => {
	console.log('========== STEP 19-C configured ==========');
	console.log(`ASI_MODE=${resolveAsiMode()} (x-asi-test-tier honored only in mock)`);
	console.log(`hard PRO operations=${ASI_HARD_PRO_OPERATIONS.join(',')}`);

	console.log('\n========== authorize matrix ==========');
	for (const operation of ASI_OPERATIONS) {
		const feature = ASI_OPERATION_FEATURE[operation];
		const row = TIERS.map((tier) => {
			const denied = authorizeAsiRequest(actorFromTier(tier), { operation });
			return `${tier}:${denied ? 'DENY' : 'ALLOW'}`;
		}).join('  ');
		console.log(`${operation.padEnd(26)} feature=${feature.padEnd(22)} hard=${HARD.has(operation)}  ${row}`);
	}

	console.log('\n========== lock CTA "PRO에서 분석하기" ==========');
	const ctaFeatures = ['competitor.gap', 'next-best-action', 'war-room', 'sov', 'opportunity.basic', 'evidence.explorer'] as const;
	for (const feature of ctaFeatures) {
		const intents = TIERS.map((tier) => `${tier}=${resolveAsiLockIntent(actorFromTier(tier), feature)}`).join('  ');
		console.log(`${feature.padEnd(22)} href=${asiHrefForFeature(feature)}  ${intents}`);
	}

	console.log('\n========== page gates vs FREE ==========');
	const view = readFileSync(resolve(process.cwd(), 'components/ai-search-intelligence/AsiFeatureView.tsx'), 'utf8');
	for (const row of PAGE_GATES) {
		const feature = asiFeatureForTool(row.tool);
		const freeBlocked = !canAccessFeature(actorFromTier('guest'), feature);
		const memberBlocked = !canAccessFeature(actorFromTier('member'), feature);
		const proOk = canAccessFeature(actorFromTier('pro'), feature);
		const adminOk = canAccessFeature(actorFromTier('admin'), feature);
		console.log(
			`${row.slug.padEnd(24)} toolGate=${feature.padEnd(20)} viewGate=${row.gatedInView} FREE_page=${freeBlocked ? 'LOCK' : 'OPEN'} MEMBER_page=${memberBlocked ? 'LOCK' : 'OPEN'} PRO=${proOk} ADMIN=${adminOk}  ${row.note}`,
		);
	}
	console.log(`AsiFeatureView wraps war-room in gate=${view.includes("if (tool === 'war-room') return gated")}`);
	console.log(`AsiFeatureView wraps opportunity in gate=${view.includes("if (tool === 'opportunity') return gated")}`);

	console.log('\n========== GNB / middleware ==========');
	const gnb = readFileSync(resolve(process.cwd(), 'components/ai-search-intelligence/shell/AsiGnbDropdown.tsx'), 'utf8');
	const mw = readFileSync(resolve(process.cwd(), 'middleware.ts'), 'utf8');
	console.log(`GNB filters by canAccessFeature=${gnb.includes('canAccessFeature')}`);
	console.log(`GNB renders ASI_PILLARS unfiltered=${gnb.includes('ASI_PILLARS.map')}`);
	console.log(`middleware auth-gates /intelligence=${mw.includes("pathname.startsWith('/intelligence')") && mw.includes('isAdminToken') && mw.includes('intelligence') && /if \(!token\).*intelligence/s.test(mw)}`);
	console.log(`middleware admin-only block is /admin only=${mw.includes("pathname.startsWith('/admin/')") && mw.includes("return NextResponse.next()")}`);

	console.log('\n========== client isAdmin leak ==========');
	const clientFiles = walk(resolve(process.cwd(), 'components/ai-search-intelligence'));
	const clientHit = clientFiles.filter((file) => /isAdmin/.test(readFileSync(file, 'utf8')));
	console.log(`ASI components using isAdmin=${clientHit.length ? clientHit.map((f) => f.replace(process.cwd(), '')).join(',') : 'none'}`);
	const actorClient = readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/entitlement/use-asi-actor.ts'), 'utf8');
	console.log(`useAsiActor reads session.user.isAdmin=${actorClient.includes('isAdmin')}`);
	console.log(`useAsiActor uses GET /api/intelligence=${actorClient.includes("fetch('/api/intelligence')")}`);
	const route = readFileSync(resolve(process.cwd(), 'app/api/intelligence/route.ts'), 'utf8');
	console.log(`API uses authorizeAsiRequest=${route.includes('authorizeAsiRequest(actor')}`);
	console.log(`API ignores body.tier=${!route.includes('body.tier')} body.isAdmin=${!route.includes('body.isAdmin')}`);

	console.log('\n========== direct API matrix ==========');
	console.log('op\tguest\tmember\tpro\tadmin\texpected');
	for (const operation of ASI_OPERATIONS) {
		const guest = await statusOf('guest', operation);
		const member = await statusOf('member', operation);
		const pro = await statusOf('pro', operation);
		const admin = await statusOf('admin', operation);
		const expectHard = HARD.has(operation);
		const guestOk = expectHard ? guest.status === 403 && guest.code === 'entitlement' : guest.status === 200;
		const memberOk = expectHard ? member.status === 403 && member.code === 'entitlement' : member.status === 200;
		const proOk = pro.status === 200;
		const adminOk = admin.status === 200;
		const ok = guestOk && memberOk && proOk && adminOk;
		console.log(
			`${ok ? 'ok' : 'FAIL'}\t${operation}\t${guest.status}/${guest.code}\t${member.status}/${member.code}\t${pro.status}/${pro.code}\t${admin.status}/${admin.code}\t${expectHard ? '403/403/200/200' : '200/200/200/200 teaser'}`,
		);
	}

	console.log('\n========== spoof ==========');
	clearAsiGuestRuns();
	const spoofs = [
		await post({ operation: 'war-room', url: URL, isAdmin: true, tier: 'admin', plan: 'pro', role: 'admin' }),
		await post({ operation: 'competitor-gap', url: URL }, { authorization: 'Bearer admin' }),
		await post({ operation: 'next-best-action', url: URL }, { cookie: 'next-auth.session-token=forged' }),
		await post({ operation: 'recommendation-test', url: URL, expandSov: true }),
	];
	for (const [i, res] of spoofs.entries()) {
		const body = (await res.json()) as { error?: { code?: string } };
		console.log(`spoof${i + 1} status=${res.status} code=${body.error?.code || 'none'}`);
	}

	console.log('\n========== live mode test-tier must not elevate ==========');
	const saved = process.env.ASI_MODE;
	process.env.ASI_MODE = 'live';
	try {
		const liveGuest = await post({ operation: 'war-room', url: URL }, { 'x-asi-test-tier': 'admin' });
		const liveBody = (await liveGuest.json()) as { error?: { code?: string } };
		console.log(`ASI_MODE=live + x-asi-test-tier=admin war-room status=${liveGuest.status} code=${liveBody.error?.code || 'none'}`);
		const liveGet = await GET(new Request('http://localhost/api/intelligence', { headers: { 'x-asi-test-tier': 'pro' } }));
		const liveGetBody = (await liveGet.json()) as { data?: { entitlement?: { tier?: string } } };
		console.log(`ASI_MODE=live GET test-tier=pro entitlement=${liveGetBody.data?.entitlement?.tier}`);
	} finally {
		if (saved === undefined) delete process.env.ASI_MODE;
		else process.env.ASI_MODE = saved;
	}

	console.log('\n========== lock source ==========');
	const lockKo = JSON.parse(readFileSync(resolve(process.cwd(), 'messages/ko.json'), 'utf8')) as {
		intelligence: { lock: { ctaAnalyze?: string } };
	};
	const cta = readFileSync(resolve(process.cwd(), 'components/ai-search-intelligence/entitlement/AsiLockCta.tsx'), 'utf8');
	console.log(`ctaAnalyze=${lockKo.intelligence.lock.ctaAnalyze}`);
	console.log(`AuthModal=${cta.includes('AuthModal')} PricingModal=${cta.includes('PricingModal')} enter=Link=${cta.includes('<Link href={href}')}`);
})();
