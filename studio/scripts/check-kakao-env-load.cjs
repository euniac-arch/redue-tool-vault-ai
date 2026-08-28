/**
 * Simulate next.config.mjs OAuth env cascade. Prints presence/length only.
 */
const fs = require('fs');
const path = require('path');
const { loadEnvConfig } = require('@next/env');

const OAUTH_ENV_KEYS = [
	'KAKAO_CLIENT_ID',
	'KAKAO_CLIENT_SECRET',
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET',
];

function parseDotenvFile(filePath) {
	if (!fs.existsSync(filePath)) return {};
	const parsed = {};
	for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq < 1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		parsed[key] = value;
	}
	return parsed;
}

function dropEmptyEnv(keys) {
	for (const key of keys) {
		if (typeof process.env[key] === 'string' && !process.env[key].trim()) {
			delete process.env[key];
		}
	}
}

function applyNonEmptyOAuthKeys(filePath) {
	const parsed = parseDotenvFile(filePath);
	for (const key of OAUTH_ENV_KEYS) {
		const value = (parsed[key] || '').trim();
		if (value) process.env[key] = value;
	}
}

const studioDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(studioDir, '..');

loadEnvConfig(repoRoot);
dropEmptyEnv(OAUTH_ENV_KEYS);
applyNonEmptyOAuthKeys(path.join(studioDir, '.env'));
applyNonEmptyOAuthKeys(path.join(studioDir, '.env.local'));

const id = (process.env.KAKAO_CLIENT_ID || '').trim();
const secret = (process.env.KAKAO_CLIENT_SECRET || '').trim();
const nextAuthUrl = (process.env.NEXTAUTH_URL || '').trim() || 'http://localhost:3000';

console.log('kakaoConfigured', Boolean(id && secret));
console.log('googleConfigured', Boolean((process.env.GOOGLE_CLIENT_ID || '').trim() && (process.env.GOOGLE_CLIENT_SECRET || '').trim()));
console.log('clientIdChars', id.length);
console.log('clientSecretChars', secret.length);
console.log('NEXTAUTH_URL', nextAuthUrl);
console.log('redirectUri', `${nextAuthUrl.replace(/\/$/, '')}/api/auth/callback/kakao`);
