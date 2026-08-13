/**
 * Local Firestore connectivity check.
 * Prints only pass/fail — never dumps credentials or document contents.
 *
 * Usage: node scripts/test-firestore-connection.cjs
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

async function main() {
	loadEnvFile(path.join(__dirname, '..', '.env'));

	const keyPathRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || '';
	const keyPath = path.isAbsolute(keyPathRaw)
		? keyPathRaw
		: path.resolve(process.cwd(), keyPathRaw);

	console.log('1) JSON path configured:', Boolean(keyPathRaw));
	console.log('2) JSON file exists:', keyPathRaw ? fs.existsSync(keyPath) : false);

	if (!keyPathRaw || !fs.existsSync(keyPath)) {
		console.log('RESULT: FAIL — set FIREBASE_SERVICE_ACCOUNT_KEY_PATH to an existing JSON file');
		process.exit(1);
	}

	const { initializeApp, cert, getApps } = require('firebase-admin/app');
	const { getFirestore, FieldValue } = require('firebase-admin/firestore');

	const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
	const projectId = sa.project_id;
	if (!projectId || !sa.client_email || !sa.private_key) {
		console.log('RESULT: FAIL — JSON missing project_id / client_email / private_key');
		process.exit(1);
	}

	console.log('3) project_id present:', Boolean(projectId));
	console.log('4) private_key PEM shape:', String(sa.private_key).includes('BEGIN PRIVATE KEY'));

	const app =
		getApps().length > 0
			? getApps()[0]
			: initializeApp({
					credential: cert({
						projectId: sa.project_id,
						clientEmail: sa.client_email,
						privateKey: String(sa.private_key).replace(/\\n/g, '\n'),
					}),
					projectId,
				});

	const db = getFirestore(app);
	const probeRef = db.collection('audit_projects').doc('_connection_probe');

	await probeRef.set({
		url: 'https://connection-probe.invalid',
		score: 0,
		issueCount: 0,
		auditPayload: { probe: true },
		createdAt: FieldValue.serverTimestamp(),
		_probe: true,
	});
	console.log('5) write audit_projects: OK');

	const snap = await probeRef.get();
	console.log('6) read audit_projects: OK', '(exists=' + snap.exists + ')');

	await probeRef.delete();
	console.log('7) delete probe doc: OK');

	const list = await db.collection('audit_projects').orderBy('createdAt', 'desc').limit(3).get();
	console.log('8) list query: OK', '(docs=' + list.size + ')');

	console.log('RESULT: PASS — Firestore connected');
	process.exit(0);
}

main().catch((err) => {
	console.log('RESULT: FAIL —', err && err.message ? err.message : String(err));
	process.exit(1);
});
