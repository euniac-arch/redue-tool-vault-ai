/**
 * Shared score → grade mapping for diagnosis report cards.
 *
 *   90–100  S     최우수 / 최상위 10% 이내
 *   80–89   A     우수
 *   70–79   B     보통 / 양호
 *    0–69   C/D   미흡 / 위험
 */

export type ScoreGrade = 'S' | 'A' | 'B' | 'C/D';

export interface ScoreGradeTheme {
	text: string;
	badge: string;
	ring: string;
	bg: string;
}

export const SCORE_GRADE_SCALE: ReadonlyArray<{
	grade: ScoreGrade;
	min: number;
	max: number;
}> = [
	{ grade: 'S', min: 90, max: 100 },
	{ grade: 'A', min: 80, max: 89 },
	{ grade: 'B', min: 70, max: 79 },
	{ grade: 'C/D', min: 0, max: 69 },
];

export function clampScore(score: number): number {
	if (!Number.isFinite(score)) return 0;
	return Math.min(100, Math.max(0, score));
}

export function gradeForScore(score: number): ScoreGrade {
	const n = clampScore(score);
	if (n >= 90) return 'S';
	if (n >= 80) return 'A';
	if (n >= 70) return 'B';
	return 'C/D';
}

/** HTTP / no-SSL origins cannot land in S or A — B is the ceiling. */
export function capGradeAtB(grade: ScoreGrade): ScoreGrade {
	return grade === 'S' || grade === 'A' ? 'B' : grade;
}

export function gradeForHttps(score: number, isHttps: boolean): ScoreGrade {
	const grade = gradeForScore(score);
	return isHttps ? grade : capGradeAtB(grade);
}

/** Map persisted / legacy labels (A+, B+, C, D, …) onto the current bands. */
export function normalizeGrade(grade: string | null | undefined): ScoreGrade {
	const key = (grade ?? '').trim().toUpperCase();
	if (key === 'S') return 'S';
	if (key === 'A' || key === 'A+') return 'A';
	if (key === 'B' || key === 'B+') return 'B';
	return 'C/D';
}

/** Prefer a live score; fall back to a stored letter when the score is missing. */
export function resolveScoreGrade(score: number | null | undefined, fallbackGrade?: string | null): ScoreGrade {
	if (typeof score === 'number' && Number.isFinite(score)) return gradeForScore(score);
	return normalizeGrade(fallbackGrade);
}

/**
 * Tone-on-tone chips: translucent grade tint + matching border.
 * Never use border-white / border-gray-* / border-slate-100 — they flash on dark cards.
 * `dark:!border-*-500/30` beats Preflight’s gray-200 when a utility is missing from CSS.
 */
const GRADE_THEMES: Record<ScoreGrade, ScoreGradeTheme> = {
	S: {
		text: 'text-indigo-600 dark:text-indigo-400',
		badge:
			'border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:!border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400',
		ring: 'ring-indigo-400/40',
		bg: 'bg-indigo-500/10',
	},
	A: {
		text: 'text-emerald-600 dark:text-emerald-400',
		badge:
			'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:!border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
		ring: 'ring-emerald-400/40',
		bg: 'bg-emerald-500/10',
	},
	B: {
		text: 'text-amber-600 dark:text-amber-400',
		badge:
			'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:!border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
		ring: 'ring-amber-400/40',
		bg: 'bg-amber-500/10',
	},
	'C/D': {
		text: 'text-rose-600 dark:text-rose-400',
		badge:
			'border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:!border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400',
		ring: 'ring-rose-400/40',
		bg: 'bg-rose-500/10',
	},
};

export function gradeTheme(grade: ScoreGrade | string): ScoreGradeTheme {
	return GRADE_THEMES[normalizeGrade(grade)];
}

/** Badge-only classes for S / A / B / C/D chips (history list, score headers). */
export function getGradeBadgeStyle(grade: ScoreGrade | string): string {
	return gradeTheme(grade).badge;
}

export function gradeThemeFromScore(score: number): ScoreGradeTheme {
	return gradeTheme(gradeForScore(score));
}

/** Top-band percentile from a 0–100 score (e.g. 78 → 22). Single source for every header. */
export function topPercentileFromScore(percentScore: number): number {
	return Math.min(99, Math.max(1, 100 - Math.round(clampScore(percentScore))));
}

/** i18n key suffix — `C/D` is not a valid next-intl nested path. */
export function gradeQualifierKey(grade: ScoreGrade): 'S' | 'A' | 'B' | 'CD' {
	return grade === 'C/D' ? 'CD' : grade;
}
