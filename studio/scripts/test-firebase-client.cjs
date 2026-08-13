/**
 * Client SDK binding check for NEXT_PUBLIC_FIREBASE_* + getDoc(audit_projects).
 * Prints pass/fail only — no secrets, no full document dumps.
 *
 * Usage: node scripts/test-firebase-client.cjs
 */
const fs = require('fs');
const path = require('path');

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

function mask(value) {
	const s = String(value || '');
	if (s.length <= 8) return s ? '(set)' : '(empty)';
	return `${s.slice(0, 4)}…${s.slice(-4)} (len=${s.length})`;
}

async function main() {
	loadEnvFile(path.join(__dirname, '..', '.env'));

	const required = [
		'NEXT_PUBLIC_FIREBASE_API_KEY',
		'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
		'NEXT_PUBLIC_FIREBASE_APP_ID',
		'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
		'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
	];

	console.log('--- Client env ---');
	let missing = 0;
	for (const k of required) {
		const ok = Boolean(process.env[k]?.trim());
		if (!ok) missing += 1;
		console.log(`${k}: ${ok ? 'SET ' + mask(process.env[k]) : 'EMPTY'}`);
	}
	if (missing) {
		console.log('RESULT: FAIL — missing NEXT_PUBLIC_FIREBASE_* values');
		process.exit(1);
	}

	const keyPathRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || '';
	const keyPath = path.isAbsolute(keyPathRaw)
		? keyPathRaw
		: path.resolve(process.cwd(), keyPathRaw);
	if (!keyPathRaw || !fs.existsSync(keyPath)) {
		console.log('RESULT: FAIL — Admin JSON needed to seed a probe doc for client getDoc');
		process.exit(1);
	}

	const { initializeApp: initAdmin, cert, getApps: getAdminApps } = require('firebase-admin/app');
	const { getFirestore: getAdminFs, FieldValue } = require('firebase-admin/firestore');
	const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

	const adminApp =
		getAdminApps().length > 0
			? getAdminApps()[0]
			: initAdmin({
					credential: cert({
						projectId: sa.project_id,
						clientEmail: sa.client_email,
						privateKey: String(sa.private_key).replace(/\\n/g, '\n'),
					}),
					projectId: sa.project_id,
				});
	const adminDb = getAdminFs(adminApp);

	const probeId = `client_probe_${Date.now()}`;
	await adminDb.collection('audit_projects').doc(probeId).set({
		url: 'https://client-probe.invalid',
		score: 42,
		issueCount: 1,
		auditPayload: {
			report: {
				url: 'https://client-probe.invalid',
				score: 42,
				maxScore: 100,
				categories: [],
				findings: [],
				lang: 'ko',
				fetchedAt: new Date().toISOString(),
				httpStatus: 200,
				responseTimeMs: 1,
				pageSizeBytes: 1,
				status: 'FAIR',
				statusLabel: 'PROBE',
			},
			issues: [{ id: 'probe', label: 'probe', status: 'fail' }],
			checklist: [],
			specs: {
				h1: { count: 0, texts: [] },
				meta: {
					pageTitle: '',
					metaDescription: '',
					titleLength: 0,
					metaDescriptionLength: 0,
				},
				schema: { coverage: 0, types: [], jsonLdBlockCount: 0 },
			},
		},
		createdAt: FieldValue.serverTimestamp(),
		_probe: true,
	});
	console.log('1) Admin seed probe doc: OK');

	const { initializeApp, getApps } = require('firebase/app');
	const { getFirestore, doc, getDoc, collection, query, orderBy, limit, getDocs } = require(
		'firebase/firestore',
	);

	const clientApp =
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

	const clientDb = getFirestore(clientApp);
	console.log('2) Client initializeApp: OK');

	try {
		const snap = await getDoc(doc(clientDb, 'audit_projects', probeId));
		console.log('3) Client getDoc: OK', `(exists=${snap.exists()})`);
		if (!snap.exists()) {
			throw new Error('probe doc not visible to client SDK');
		}
		const data = snap.data() || {};
		console.log('4) Client payload shape: OK', `(url=${Boolean(data.url)} score=${data.score})`);
	} catch (err) {
		await adminDb.collection('audit_projects').doc(probeId).delete().catch(() => null);
		console.log('3) Client getDoc: FAIL —', err && err.message ? err.message : String(err));
		console.log(
			'HINT: Firestore security rules may block unauthenticated reads. For /admin/solve client getDoc, allow read on audit_projects or keep using the server API fallback.',
		);
		console.log('RESULT: FAIL — client binding blocked');
		process.exit(1);
	}

	try {
		const q = query(collection(clientDb, 'audit_projects'), orderBy('createdAt', 'desc'), limit(3));
		const list = await getDocs(q);
		console.log('5) Client list query: OK', `(docs=${list.size})`);
	} catch (err) {
		console.log('5) Client list query: FAIL —', err && err.message ? err.message : String(err));
	}

	await adminDb.collection('audit_projects').doc(probeId).delete();
	console.log('6) Admin cleanup probe: OK');
	console.log('RESULT: PASS — Firebase client binding works');
	process.exit(0);
}

main().catch((err) => {
	console.log('RESULT: FAIL —', err && err.message ? err.message : String(err));
	process.exit(1);
});
