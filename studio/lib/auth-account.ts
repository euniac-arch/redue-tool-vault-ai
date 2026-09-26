export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const RESET_IDENTIFIER_PREFIX = 'reset:';
const PASSWORD_RESET_FALLBACK_ORIGIN = 'https://reduegeo.com';

function isLocalOrigin(value: string): boolean {
	return /localhost|127\.0\.0\.1/i.test(value);
}

/** Public site origin for reset links. Ignores a localhost `NEXTAUTH_URL` on production. */
export function resolvePasswordResetBaseUrl(): string {
	const configured = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXTAUTH_URL]
		.map((value) => (value || '').trim().replace(/\/$/, ''))
		.filter(Boolean);
	const publicOrigin = configured.find((value) => !isLocalOrigin(value));
	if (publicOrigin) return publicOrigin;
	if (process.env.VERCEL || process.env.NODE_ENV === 'production') return PASSWORD_RESET_FALLBACK_ORIGIN;
	return configured[0] || 'http://localhost:3000';
}

export function buildPasswordResetUrl(email: string, token: string): string {
	const base = resolvePasswordResetBaseUrl();
	return `${base}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

export function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}

export function normalizeName(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizePhone(value: string): string {
	return value.replace(/\D/g, '');
}

/** Digits plus common hyphen layouts so older rows still match an exact query. */
export function phoneLookupVariants(value: string): string[] {
	const digits = normalizePhone(value);
	const variants = new Set<string>();
	if (!digits) return [];
	variants.add(digits);
	if (digits.length === 11) {
		variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
	} else if (digits.length === 10) {
		variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
		variants.add(`${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`);
	}
	return [...variants];
}

export function phonesMatch(stored: string | null | undefined, query: string): boolean {
	const left = normalizePhone(stored || '');
	const right = normalizePhone(query);
	return Boolean(left) && left === right;
}

export function maskEmail(email: string): string {
	const trimmed = email.trim();
	const at = trimmed.indexOf('@');
	if (at <= 0) return '***';
	const local = trimmed.slice(0, at);
	const domain = trimmed.slice(at + 1);
	const visible = local.slice(0, Math.min(3, local.length));
	return `${visible}***@${domain}`;
}

export function resetIdentifier(email: string): string {
	return `${RESET_IDENTIFIER_PREFIX}${normalizeEmail(email)}`;
}

export function validatePasswordStrength(password: string): string | null {
	if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
	if (!/[A-Za-z]/.test(password)) return '비밀번호에 영문을 포함해 주세요.';
	if (!/[0-9]/.test(password)) return '비밀번호에 숫자를 포함해 주세요.';
	if (!/[^A-Za-z0-9]/.test(password)) return '비밀번호에 특수문자를 포함해 주세요.';
	return null;
}

export function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}
