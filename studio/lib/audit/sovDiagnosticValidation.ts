/**
 * Share-of-Voice leaderboard integrity checks — generic, site-agnostic
 * validators for the unified market ranking card's 100%-pie / gap-formula
 * invariants. No business or site is hardcoded here; every threshold is a
 * universal rule (share sum, gap formula, unranked-tone mapping).
 */

import { normalizeSovKeyword, type SovShareTable } from '@/lib/audit/sovLeaderboardData';
import { queryContainsBrandToken } from '@/lib/audit/universal-sov-engine';

export const SOV_SHARE_SUM_TARGET = 100;
export const SOV_SHARE_SUM_TOLERANCE = 0.01;
export const SOV_MAJORITY_THRESHOLD = 50;

/** Below this own-share, the unranked badge tone escalates from warning to danger. */
export const SOV_DANGER_SHARE_THRESHOLD = 10;

export const SOV_VALIDATION_PASS_MESSAGE = '정합성 검증 완료: SoV 데이터 100% 일치';

export type SovOwnBadgeTone = 'danger' | 'warning' | 'ok';

export interface SovValidationIssue {
	code:
		| 'SHARE_SUM'
		| 'GAP_MISMATCH'
		| 'SHARE_RANGE'
		| 'KEYWORD_MISSING'
		| 'KEYWORD_TABLE'
		| 'KEYWORD_STALE'
		| 'BASELINE_MISMATCH'
		| 'RANK_INCONSISTENT'
		| 'INCOMPLETE';
	message: string;
}

export interface SovValidationLeaderboardRow {
	share: number;
	isClient?: boolean;
	isThirdParty?: boolean;
	rank?: number;
	name?: string;
}

export interface SovKeywordShareSlice {
	currentSov: number;
	targetSov: number;
	potentialGain?: number;
	rank1: number;
	rank2: number;
	thirdParty: number;
}

export interface SovLeaderboardValidationInput {
	brandName?: string;
	siteUrl?: string;
	keywords?: readonly string[];
	currentSov?: number;
	targetSov?: number;
	potentialGain?: number;
	rank1?: number;
	rank2?: number;
	thirdParty?: number;
	clientRank?: number;
	rankText?: string;
	leaderboard?: readonly SovValidationLeaderboardRow[];
	perKeyword?: Record<string, SovKeywordShareSlice>;
}

export interface SovUiValidationTokens {
	ownBadgeTone: SovOwnBadgeTone;
	ownBadgeClassName: string;
	ownShareClassName: string;
	thirdPartyIsMajority: boolean;
	thirdPartyBarWidth: number;
	thirdPartyMajorityClassName: string;
}

export interface SovValidationResult {
	valid: boolean;
	errors: SovValidationIssue[];
	warnings: SovValidationIssue[];
	checks: {
		shareSum100: boolean;
		gapFormula: boolean;
		keywordsPresent: boolean;
		perKeywordTables: boolean;
		keywordTablesRefresh: boolean;
		ownShareInRange: boolean;
		thirdPartyMajority: boolean;
		unrankedTone: boolean;
	};
	ui: SovUiValidationTokens;
	slices: SovKeywordShareSlice | null;
	message: string;
}

export const SOV_OWN_BADGE_TONE_CLASSES: Record<SovOwnBadgeTone, string> = {
	danger:
		'rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-400',
	warning:
		'rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400',
	ok: 'rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400',
};

export const SOV_OWN_SHARE_TONE_CLASSES: Record<SovOwnBadgeTone, string> = {
	danger: 'font-extrabold text-rose-600 dark:text-rose-400',
	warning: 'font-extrabold text-amber-700 dark:text-amber-400',
	ok: 'font-extrabold text-indigo-600 dark:text-indigo-400',
};

export const SOV_OWN_RANK_TONE_CLASSES: Record<SovOwnBadgeTone, string> = {
	danger: 'inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-rose-600 px-1 text-[10px] font-black text-white',
	warning:
		'inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-amber-500 px-1 text-[10px] font-black text-white',
	ok: 'inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-indigo-600 px-1 text-[10px] font-black text-white',
};

export const SOV_THIRD_PARTY_MAJORITY_BADGE_CLASS =
	'rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300';

function nearlyEqual(a: number, b: number, tolerance = SOV_SHARE_SUM_TOLERANCE): boolean {
	return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
}

function isShareInRange(value: number): boolean {
	return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function isOutsideTop3(clientRank?: number, rankText?: string): boolean {
	if (typeof clientRank === 'number' && clientRank >= 4) return true;
	return /3위\s*밖|순위\s*밖|outside\s+the\s+top\s*3|unranked/i.test(rankText || '');
}

export function isThirdPartyMajority(share: number): boolean {
	return Number.isFinite(share) && share > SOV_MAJORITY_THRESHOLD;
}

export function resolveSovOwnBadgeTone(input: {
	clientRank?: number;
	rankText?: string;
	currentSov?: number;
}): SovOwnBadgeTone {
	if (!isOutsideTop3(input.clientRank, input.rankText)) return 'ok';
	return (input.currentSov ?? 0) <= SOV_DANGER_SHARE_THRESHOLD ? 'danger' : 'warning';
}

export function resolveSovUiTokens(input: {
	clientRank?: number;
	rankText?: string;
	currentSov?: number;
	thirdParty?: number;
}): SovUiValidationTokens {
	const ownBadgeTone = resolveSovOwnBadgeTone(input);
	const thirdParty = input.thirdParty ?? 0;
	return {
		ownBadgeTone,
		ownBadgeClassName: SOV_OWN_BADGE_TONE_CLASSES[ownBadgeTone],
		ownShareClassName: SOV_OWN_SHARE_TONE_CLASSES[ownBadgeTone],
		thirdPartyIsMajority: isThirdPartyMajority(thirdParty),
		thirdPartyBarWidth: Math.min(100, Math.max(0, thirdParty)),
		thirdPartyMajorityClassName: SOV_THIRD_PARTY_MAJORITY_BADGE_CLASS,
	};
}

export function sovShareTableFingerprint(table: Pick<SovKeywordShareSlice, 'rank1' | 'rank2' | 'currentSov' | 'thirdParty' | 'targetSov'>): string {
	return [table.rank1, table.rank2, table.currentSov, table.thirdParty, table.targetSov].join('|');
}

export function didSovTableRefresh(
	previous: Pick<SovKeywordShareSlice, 'rank1' | 'rank2' | 'currentSov' | 'thirdParty' | 'targetSov'> | null | undefined,
	next: Pick<SovKeywordShareSlice, 'rank1' | 'rank2' | 'currentSov' | 'thirdParty' | 'targetSov'>,
): boolean {
	if (!previous) return true;
	return sovShareTableFingerprint(previous) !== sovShareTableFingerprint(next);
}

function slicesFromLeaderboard(
	rows: readonly SovValidationLeaderboardRow[] | undefined,
): Partial<SovKeywordShareSlice> {
	if (!rows?.length) return {};
	const ranking = rows.filter((row) => !row.isThirdParty);
	const directory = rows.find((row) => row.isThirdParty);
	const ownRow = ranking.find((row) => row.isClient);
	const rank1 = ranking.find((row) => row.rank === 1 && !row.isClient) ?? ranking.find((row) => row.rank === 1);
	const rank2 = ranking.find((row) => row.rank === 2 && !row.isClient) ?? ranking.find((row) => row.rank === 2);
	return {
		rank1: rank1?.share,
		rank2: rank2?.share,
		currentSov: ownRow?.share,
		thirdParty: directory?.share,
	};
}

export function resolveSovShareSlices(data: SovLeaderboardValidationInput): SovKeywordShareSlice | null {
	const fromBoard = slicesFromLeaderboard(data.leaderboard);
	const rank1 = data.rank1 ?? fromBoard.rank1;
	const rank2 = data.rank2 ?? fromBoard.rank2;
	const currentSov = data.currentSov ?? fromBoard.currentSov;
	const thirdParty = data.thirdParty ?? fromBoard.thirdParty;
	const targetSov = data.targetSov;
	if (
		rank1 == null ||
		rank2 == null ||
		currentSov == null ||
		thirdParty == null ||
		targetSov == null
	) {
		return null;
	}
	return {
		rank1,
		rank2,
		currentSov,
		thirdParty,
		targetSov,
		potentialGain: data.potentialGain ?? targetSov - currentSov,
	};
}

function pushError(errors: SovValidationIssue[], code: SovValidationIssue['code'], message: string) {
	errors.push({ code, message });
}

function validateShareSlice(
	slice: SovKeywordShareSlice,
	label: string,
	errors: SovValidationIssue[],
): { shareSum100: boolean; gapFormula: boolean; ownShareInRange: boolean } {
	const total = slice.rank1 + slice.rank2 + slice.currentSov + slice.thirdParty;
	const shareSum100 = nearlyEqual(total, SOV_SHARE_SUM_TARGET);
	if (!shareSum100) {
		pushError(errors, 'SHARE_SUM', `${label}: 점유율 합계 ${total}% ≠ ${SOV_SHARE_SUM_TARGET}%`);
	}

	const expectedGain = slice.targetSov - slice.currentSov;
	const actualGain = slice.potentialGain ?? expectedGain;
	const gapFormula = nearlyEqual(actualGain, expectedGain);
	if (!gapFormula) {
		pushError(
			errors,
			'GAP_MISMATCH',
			`${label}: 격차 ${actualGain}%p ≠ 목표 ${slice.targetSov}% − 현재 ${slice.currentSov}%`,
		);
	}

	const ownShareInRange = [slice.rank1, slice.rank2, slice.currentSov, slice.thirdParty, slice.targetSov].every(
		isShareInRange,
	);
	if (!ownShareInRange) {
		pushError(errors, 'SHARE_RANGE', `${label}: 점유율 값이 0–100 범위를 벗어났습니다.`);
	}

	return { shareSum100, gapFormula, ownShareInRange };
}

export function formatSovValidationPassMessage(): string {
	return SOV_VALIDATION_PASS_MESSAGE;
}

export function logSovValidationResult(result: SovValidationResult): void {
	if (result.valid) {
		console.info(result.message);
		return;
	}
	console.warn(
		'[SoV validation failed]',
		result.errors.map((issue) => `${issue.code}: ${issue.message}`).join(' | '),
	);
}

export function shareTableToKeywordSlice(table: SovShareTable): SovKeywordShareSlice {
	return {
		rank1: table.rank1,
		rank2: table.rank2,
		currentSov: table.own,
		thirdParty: table.thirdParty,
		targetSov: table.targetSov,
		potentialGain: table.potentialGain,
	};
}

/**
 * Validates a SoV leaderboard payload: 100% pie, To-Be − As-Is gap,
 * optional keyword coverage, and UI tokens for unranked / 3rd-party majority.
 */
export function validateSovLeaderboardData(data: SovLeaderboardValidationInput): SovValidationResult {
	const errors: SovValidationIssue[] = [];
	const warnings: SovValidationIssue[] = [];
	const slices = resolveSovShareSlices(data);
	const ui = resolveSovUiTokens({
		clientRank: data.clientRank,
		rankText: data.rankText,
		currentSov: slices?.currentSov ?? data.currentSov,
		thirdParty: slices?.thirdParty ?? data.thirdParty,
	});

	let shareSum100 = false;
	let gapFormula = false;
	let ownShareInRange = false;

	if (!slices) {
		pushError(errors, 'INCOMPLETE', '점유율 슬라이스(자사/1위/2위/3자/목표)가 모두 있어야 합니다.');
	} else {
		const sliceChecks = validateShareSlice(slices, '리더보드', errors);
		shareSum100 = sliceChecks.shareSum100;
		gapFormula = sliceChecks.gapFormula;
		ownShareInRange = sliceChecks.ownShareInRange;
	}

	const keywordsPresent = true;

	let perKeywordTables = true;
	let keywordTablesRefresh = true;
	const keywordEntries = Object.entries(data.perKeyword || {}).map(([keyword, table]) => [
		normalizeSovKeyword(keyword),
		table,
	]) as Array<[string, SovKeywordShareSlice]>;

	if (keywordEntries.length) {
		const fingerprints = new Set<string>();
		for (const [keyword, table] of keywordEntries) {
			const labeled = validateShareSlice(table, `#${keyword}`, errors);
			if (!labeled.shareSum100 || !labeled.gapFormula || !labeled.ownShareInRange) {
				perKeywordTables = false;
			}
			fingerprints.add(sovShareTableFingerprint(table));
		}
		if (keywordEntries.length >= 2) {
			keywordTablesRefresh = fingerprints.size >= 2;
			if (!keywordTablesRefresh) {
				pushError(errors, 'KEYWORD_STALE', '타겟 쿼리 전환 시 순위 테이블 수치가 갱신되지 않았습니다.');
			}
		}
	}

	const brandTokens = [data.brandName].filter((token): token is string => Boolean(token));
	const navigationalKeywords = (data.keywords || []).filter((keyword) => queryContainsBrandToken(keyword, brandTokens));
	if (navigationalKeywords.length && slices && queryContainsBrandToken(navigationalKeywords[0] || '', brandTokens)) {
		if (data.clientRank != null && data.clientRank !== 1 && queryContainsBrandToken(navigationalKeywords[0] || '', brandTokens)) {
			pushError(errors, 'RANK_INCONSISTENT', '브랜드 직검색 질의인데 자사 순위가 1위가 아닙니다.');
		}
	}
	if (data.clientRank === 1 && slices && slices.currentSov < 80 && navigationalKeywords.length) {
		pushError(errors, 'RANK_INCONSISTENT', '브랜드 직검색 질의의 자사 점유율이 80% 미만입니다.');
	}

	const unrankedTone = !isOutsideTop3(data.clientRank, data.rankText) || ui.ownBadgeTone !== 'ok';
	if (isOutsideTop3(data.clientRank, data.rankText) && ui.ownBadgeTone === 'ok') {
		warnings.push({ code: 'RANK_INCONSISTENT', message: '3위 밖인데 자사 뱃지 톤이 경고/위험이 아닙니다.' });
	}

	const valid = errors.length === 0;
	return {
		valid,
		errors,
		warnings,
		checks: {
			shareSum100,
			gapFormula,
			keywordsPresent,
			perKeywordTables,
			keywordTablesRefresh,
			ownShareInRange,
			thirdPartyMajority: ui.thirdPartyIsMajority,
			unrankedTone,
		},
		ui,
		slices,
		message: valid ? formatSovValidationPassMessage() : errors[0]?.message || 'SoV 데이터 정합성 오류',
	};
}
