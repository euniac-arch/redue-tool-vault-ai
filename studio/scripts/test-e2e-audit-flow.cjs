/**
 * End-to-end flow:
 * scan → Firestore id → /api/audit/[id] → /admin/solve?id= → /api/admin/projects
 *
 * Usage: node scripts/test-e2e-audit-flow.cjs [url]
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const TARGET = process.argv[2] || 'https://example.com';

function loadEnvFile(filePath) {
	if (!fs.existsSync(filePath)) return;
	const raw = fs.readFileSync(filePath, 'utf8');
	for (const line of raw.split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const i = t.indexOf('=');
		if (i < 0) continue;
		const k = t.slice(0, i).trim();
		let v = t.slice(i + 1).trim();
		if (
			(v.startsWith('"') && v.endsWith('"')) ||
			(v.startsWith("'") && v.endsWith("'"))
		) {
			v = v.slice(1, -1);
		}
		if (!(k in process.env)) process.env[k] = v;
	}
}

async function main() {
	loadEnvFile(path.join(__dirname, '..', '.env'));
	const results = [];

	function pass(step, detail) {
		results.push({ step, ok: true, detail });
		console.log(`PASS  ${step}${detail ? ' — ' + detail : ''}`);
	}
	function fail(step, detail) {
		results.push({ step, ok: false, detail });
		console.log(`FAIL  ${step}${detail ? ' — ' + detail : ''}`);
	}

	// 1) Live scan
	let scan;
	try {
		const res = await fetch(`${BASE}/api/audit/scan`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: TARGET, lang: 'ko' }),
		});
		scan = await res.json();
		if (!res.ok) throw new Error(scan.error || `HTTP ${res.status}`);
		if (!scan.id) throw new Error('response missing Firestore id');
		if (!scan.url) throw new Error('response missing url');
		pass(
			'1 scan API',
			`id=${scan.id} score=${scan.score} url=${scan.url}`,
		);
	} catch (err) {
		fail('1 scan API', err.message || String(err));
		console.log('RESULT: FAIL');
		process.exit(1);
	}

	const docId = scan.id;

	// 2) Load by id (server prefers Firestore)
	try {
		const res = await fetch(`${BASE}/api/audit/${encodeURIComponent(docId)}`);
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
		if (data.source !== 'firestore') {
			throw new Error(`expected source=firestore, got ${data.source}`);
		}
		if (!data.report?.url) throw new Error('missing report.url');
		pass(
			'2 GET /api/audit/[id]',
			`source=${data.source} score=${data.score} issues=${data.issueCount}`,
		);
	} catch (err) {
		fail('2 GET /api/audit/[id]', err.message || String(err));
	}

	// 3) Admin solve page HTML with ?id=
	try {
		const res = await fetch(`${BASE}/admin/solve?id=${encodeURIComponent(docId)}`);
		const html = await res.text();
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const hasUrl = html.includes(scan.url) || html.includes('example.com');
		const hasScore = String(Math.round(scan.score)).length > 0 && html.includes(String(Math.round(scan.score)));
		if (!hasUrl && !html.includes('해결')) {
			throw new Error('solve page did not render expected content');
		}
		pass(
			'3 /admin/solve?id=',
			`status=${res.status} urlInPage=${hasUrl} scoreInPage=${hasScore}`,
		);
	} catch (err) {
		fail('3 /admin/solve?id=', err.message || String(err));
	}

	// 4) Projects API lists Firestore docs
	try {
		const res = await fetch(`${BASE}/api/admin/projects`);
		const data = await res.json();
		if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
		if (data.source !== 'firestore') {
			throw new Error(`expected source=firestore, got ${data.source}`);
		}
		const projects = data.projects || [];
		const audits = data.recentAudits || [];
		const hit =
			projects.find((p) => p.id === docId || p.latestAuditId === docId) ||
			audits.find((a) => a.auditId === docId);
		if (!hit) throw new Error(`doc ${docId} not found in projects/recentAudits`);
		pass(
			'4 GET /api/admin/projects',
			`source=${data.source} projects=${projects.length} foundId=true`,
		);
	} catch (err) {
		fail('4 GET /api/admin/projects', err.message || String(err));
	}

	// 5) Projects page renders
	try {
		const res = await fetch(`${BASE}/admin/projects`);
		const html = await res.text();
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		if (!html.includes('프로젝트')) throw new Error('projects page missing expected UI text');
		pass('5 /admin/projects page', `status=${res.status}`);
	} catch (err) {
		fail('5 /admin/projects page', err.message || String(err));
	}

	// 6) Client getDoc for same id
	try {
		const { initializeApp, getApps } = require('firebase/app');
		const { getFirestore, doc, getDoc } = require('firebase/firestore');
		const app =
			getApps().length > 0
				? getApps()[0]
				: initializeApp({
						apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
						authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
						projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
						storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
						messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
						appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
					});
		const snap = await getDoc(doc(getFirestore(app), 'audit_projects', docId));
		if (!snap.exists()) throw new Error('client getDoc: doc missing');
		const d = snap.data();
		pass('6 Client getDoc', `exists=true score=${d.score} issueCount=${d.issueCount}`);
	} catch (err) {
		fail('6 Client getDoc', err.message || String(err));
	}

	const failed = results.filter((r) => !r.ok);
	console.log('---');
	console.log(`docId=${docId}`);
	console.log(`solveUrl=${BASE}/admin/solve?id=${encodeURIComponent(docId)}`);
	console.log(`projectsUrl=${BASE}/admin/projects`);
	if (failed.length) {
		console.log(`RESULT: FAIL (${failed.length} step(s))`);
		process.exit(1);
	}
	console.log('RESULT: PASS — full audit → solve/projects flow OK');
	process.exit(0);
}

main().catch((err) => {
	console.log('RESULT: FAIL —', err.message || String(err));
	process.exit(1);
});
