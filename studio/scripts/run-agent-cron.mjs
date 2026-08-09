#!/usr/bin/env node
/**
 * Trigger the Autonomous Self-Healing cron against a running Next.js server.
 * Usage:
 *   AGENT_CRON_SECRET=... npm run agent:cron
 *   AGENT_CRON_URL=http://localhost:3000/api/agent/cron npm run agent:cron
 */
async function main() {
	const base = (process.env.AGENT_CRON_URL || 'http://localhost:3000/api/agent/cron').replace(/\/$/, '');
	const secret = process.env.AGENT_CRON_SECRET || '';
	const headers = { Accept: 'application/json' };
	if (secret) headers.Authorization = `Bearer ${secret}`;

	const res = await fetch(base, { method: 'POST', headers });
	const text = await res.text();
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		body = { raw: text };
	}
	if (!res.ok) {
		console.error('Cron failed', res.status, body);
		process.exit(1);
	}
	console.log(JSON.stringify(body, null, 2));
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
