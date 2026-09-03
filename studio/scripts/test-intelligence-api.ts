/**
 * /api/intelligence integration — route handlers, not the Next HTTP server.
 * Run: npx tsx scripts/test-intelligence-api.ts
 */
import { GET, POST } from '../app/api/intelligence/route';
import { ASI_OPERATIONS } from '../lib/ai-search-intelligence/api/operations';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

async function readJson(res: Response) {
	return (await res.json()) as Record<string, unknown>;
}

function post(body: unknown) {
	return POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'accept-language': 'ko', 'x-asi-test-tier': 'pro' },
			body: typeof body === 'string' ? body : JSON.stringify(body),
		}),
	);
}

function isEnvelope(body: Record<string, unknown>) {
	return (
		typeof body.success === 'boolean' &&
		'data' in body &&
		body.meta &&
		typeof body.meta === 'object' &&
		typeof (body.meta as { requestId?: string }).requestId === 'string' &&
		'error' in body
	);
}

void (async () => {
	const statusRes = await GET(new Request('http://localhost/api/intelligence'));
	assert('GET status 200', statusRes.status === 200);
	const status = await readJson(statusRes);
	assert('GET uses envelope', isEnvelope(status));
	assert('GET success', status.success === true);
	const statusData = status.data as { mode?: string; providers?: unknown[] } | null;
	assert('GET mode is mock, live, or hybrid', statusData?.mode === 'mock' || statusData?.mode === 'live' || statusData?.mode === 'hybrid');
	assert('GET has 4 providers', Array.isArray(statusData?.providers) && statusData.providers.length === 4);
	const usage = (statusData as { usage?: unknown } | null)?.usage;
	assert('GET does not expose global usage internals', usage === undefined);
	const accountUsage = (statusData as { accountUsage?: { estimated?: boolean; queriesUsed?: number; queriesLimit?: number } } | null)?.accountUsage;
	assert('GET account usage is estimated', accountUsage?.estimated === true);
	assert('GET account usage has query counters', typeof accountUsage?.queriesUsed === 'number' && typeof accountUsage?.queriesLimit === 'number');
	assert('GET account usage has remaining', typeof (accountUsage as { remaining?: number })?.remaining === 'number');
	assert('GET leaks no API_KEY', !JSON.stringify(status).includes('API_KEY'));
	assert('GET leaks no sk-', !JSON.stringify(status).includes('sk-'));

	const badJson = await post('{');
	assert('POST invalid json is 400', badJson.status === 400);
	const badJsonBody = await readJson(badJson);
	assert('POST invalid json envelope', isEnvelope(badJsonBody) && badJsonBody.success === false);
	assert('POST invalid json code', (badJsonBody.error as { code?: string })?.code === 'invalid_json');

	const badAction = await post({ action: 'not-a-pillar', url: 'https://sunshineclinic.kr' });
	assert('POST invalid operation is 400', badAction.status === 400);
	assert('POST invalid operation code', ((await readJson(badAction)).error as { code?: string })?.code === 'invalid_operation');

	const badUrl = await post({ operation: 'war-room', url: 'not-a-url' });
	assert('POST invalid url is 422', badUrl.status === 422);
	const badUrlBody = await readJson(badUrl);
	assert('POST invalid url envelope', badUrlBody.success === false && badUrlBody.data === null);
	assert('POST invalid url code', (badUrlBody.error as { code?: string })?.code === 'invalid_url');
	assert('POST invalid url message is user-safe', typeof (badUrlBody.error as { message?: string })?.message === 'string');

	const war = await post({ operation: 'war-room', url: 'https://sunshineclinic.kr' });
	assert('POST war-room 200', war.status === 200);
	const warBody = await readJson(war);
	assert('POST war-room envelope', isEnvelope(warBody) && warBody.success === true);
	const warData = warBody.data as { snapshot?: { kpis?: { visibility?: number } } } | null;
	assert('POST war-room snapshot', Boolean(warData?.snapshot?.kpis));
	assert(
		'POST war-room visibility in range',
		typeof warData?.snapshot?.kpis?.visibility === 'number' &&
			warData.snapshot.kpis.visibility >= 0 &&
			warData.snapshot.kpis.visibility <= 100,
	);
	assert('POST war-room requestId', Boolean((warBody.meta as { requestId?: string })?.requestId));

	const alias = await post({ action: 'evidence', url: 'https://sunshineclinic.kr' });
	assert('POST evidence alias 200', alias.status === 200);
	assert('POST evidence snapshot', Boolean(((await readJson(alias)).data as { snapshot?: unknown })?.snapshot));

	for (const operation of ASI_OPERATIONS) {
		const res = await post({ operation, url: 'https://sunshineclinic.kr' });
		const body = await readJson(res);
		assert(`POST ${operation} 200`, res.status === 200, String(res.status));
		assert(`POST ${operation} envelope`, isEnvelope(body) && body.success === true);
		assert(`POST ${operation} snapshot`, Boolean((body.data as { snapshot?: unknown })?.snapshot));
	}

	const cancel = await post({ operation: 'cancel', requestId: 'asi_missing' });
	assert('POST cancel 200', cancel.status === 200);
	const cancelBody = await readJson(cancel);
	assert('POST cancel envelope', isEnvelope(cancelBody) && cancelBody.success === true);
	assert('POST cancel missing is false', (cancelBody.data as { cancelled?: boolean })?.cancelled === false);

	const flooded = await post({
		operation: 'query-generator',
		url: 'https://sunshineclinic.kr',
		queries: Array.from({ length: 20 }, (_, i) => `질문 ${i}`),
	});
	assert('POST flood 200', flooded.status === 200);
	const floodBody = await readJson(flooded);
	const probe = (floodBody.data as { snapshot?: { queryProbe?: { current?: { queries?: string[] } } } })?.snapshot?.queryProbe
		?.current;
	assert('POST flood caps at 10 queries', (probe?.queries?.length ?? 0) <= 10);

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
