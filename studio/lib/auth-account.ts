export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const RESET_IDENTIFIER_PREFIX = 'reset:';

export function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}

export function normalizeName(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizePhone(value: string): string {
	return value.replace(/\D/g, '');
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
