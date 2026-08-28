/**
 * Safe Kakao/NextAuth env diagnostic — prints presence/length only, never secret values.
 */
const fs = require('fs');
const path = require('path');

const KEYS = [
	'KAKAO_CLIENT_ID',
	'KAKAO_CLIENT_SECRET',
	'NEXTAUTH_URL',
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET',
];

const FILES = [
	'../.env',
	'../.env.local',
	'../.env.development',
	'../.env.development.local',
	'.env',
	'.env.local',
	'.env.development',
	'.env.development.local',
];

function parseFile(file) {
	const text = fs.readFileSync(file, 'utf8');
	const found = {};
	for (const line of text.split(/\r?\n/)) {
		const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
		if (!match || !KEYS.includes(match[1])) continue;
		let value = match[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		found[match[1]] = { empty: !value.trim(), length: value.trim().length };
	}
	return found;
}

for (const rel of FILES) {
	const full = path.resolve(__dirname, '..', rel);
	if (!fs.existsSync(full)) {
		console.log(`${rel}\tMISSING`);
		continue;
	}
	console.log(`${rel}\tEXISTS`);
	const found = parseFile(full);
	for (const key of KEYS) {
		const info = found[key];
		if (!info) console.log(`  ${key}: not-in-file`);
		else console.log(`  ${key}: ${info.empty ? 'EMPTY' : 'SET'} len=${info.length}`);
	}
}
