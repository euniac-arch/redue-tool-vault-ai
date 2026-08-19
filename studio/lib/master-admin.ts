/**
 * Local / bootstrap master-admin credentials.
 * Env vars win; hardcoded fallbacks keep `admin` / `jooni1428` working
 * even when `.env.local` is incomplete.
 */
export const MASTER_ADMIN_ID = (process.env.MASTER_ADMIN_ID || 'admin-master-id').trim();

export const MASTER_ADMIN_EMAIL = (
	process.env.MASTER_ADMIN_EMAIL ||
	process.env.ADMIN_EMAIL ||
	'admin'
)
	.trim()
	.toLowerCase();

export const MASTER_ADMIN_PASSWORD =
	process.env.MASTER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'jooni1428';

export const MASTER_ADMIN_NAME = (process.env.MASTER_ADMIN_NAME || 'REDUE Admin').trim();

/** Session / JWT role for the bootstrap administrator. */
export const MASTER_ADMIN_ROLE = 'ADMIN' as const;

const EXTRA_ADMIN_ALIASES = ['admin', 'admin@redue.ai'];

function uniqueLower(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

/** Login ids that grant ADMIN on credentials sign-in. */
export function masterAdminLoginIds(): string[] {
	return uniqueLower([MASTER_ADMIN_EMAIL, ...EXTRA_ADMIN_ALIASES]);
}

export function normalizeLoginIdentifier(raw: string): string {
	const value = raw.trim().toLowerCase();
	if (isMasterAdminLoginId(value)) return MASTER_ADMIN_EMAIL;
	return value;
}

export function isMasterAdminLoginId(raw: string): boolean {
	const value = raw.trim().toLowerCase();
	return masterAdminLoginIds().includes(value);
}

export function isMasterAdminPassword(password: string): boolean {
	return password === MASTER_ADMIN_PASSWORD;
}

/**
 * Dev-only NextAuth secret so local login still issues JWTs when
 * `NEXTAUTH_SECRET` is missing from `.env.local`.
 */
export function resolveNextAuthSecret(): string {
	const fromEnv = process.env.NEXTAUTH_SECRET?.trim();
	if (fromEnv) return fromEnv;
	if (process.env.NODE_ENV === 'production') {
		return '';
	}
	return 'redue-dev-nextauth-secret-admin-master-fallback';
}

function envAdminEmails(): string[] {
	return (process.env.ADMIN_EMAILS || '')
		.split(',')
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean);
}

/** Allowlist plus the bootstrap admin id (`admin`). */
export function isAdminEmail(email: string): boolean {
	const normalized = email.trim().toLowerCase();
	if (!normalized) return false;
	if (isMasterAdminLoginId(normalized)) return true;
	return envAdminEmails().includes(normalized);
}

export function isDbAdminRole(role: string | null | undefined): boolean {
	return (role || '').trim().toLowerCase() === 'admin';
}
