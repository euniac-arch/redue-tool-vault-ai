/**
 * Channel NAP (Name / Address / Phone) consistency matrix.
 *
 * Official homepage NAP is the canonical baseline. Other channels are compared
 * after light normalization (whitespace, hyphens, unit/floor tokens) so a
 * spacing-only gap is WARNING, a real fact gap is MISMATCH, and a missing
 * listing is NOT_FOUND.
 */
import { detectEnginePlatformSignals } from '@/lib/audit/engine-analysis';
import { extractSignalsFromReport } from '@/lib/audit/geo-score';
import { resolveProjectSiteName } from '@/lib/audit/project-site-name';
import { attachQuotedPostposition, withJosa } from '@/lib/korean-josa';
import {
	isGoogleMapsGbpUrl,
	isKakaoChannelMapUrl,
	isNaverPlaceMapUrl,
	validateChannelSignals,
} from '@/lib/audit/extractors/universal-same-as';
import type { AuditReport } from '@/lib/site-auditor';
import type {
	GuideSocialLinks,
	NapChannelCollected,
	NapChannelId,
	NapChannelRow,
	NapConsistencyStatus,
	NapMatrix,
	NapRecommendation,
} from '@/types/guide';

export type {
	NapChannelCollected,
	NapChannelId,
	NapChannelRow,
	NapConsistencyStatus,
	NapMatrix,
	NapRecommendation,
};

/** Matches Gemini/OpenAI napMatrix.channels order in geo-narrative prompts. */
export const NAP_CHANNEL_ORDER: readonly NapChannelId[] = [
	'homepage',
	'naver_place',
	'kakao_tmap',
	'google_business',
	'sns',
	'youtube',
	'bing_places',
] as const;

export const NAP_CHANNEL_LABEL: Record<NapChannelId, string> = {
	homepage: '공식 홈페이지',
	naver_place: '네이버 플레이스 / 지도',
	kakao_tmap: '카카오맵 / 카카오 채널',
	google_business: '구글 비즈니스 프로필 (GBP)',
	sns: '인스타그램 (SNS)',
	youtube: '유튜브 (YouTube)',
	bing_places: 'Bing Places',
};

const PLACE_CHANNELS = new Set<NapChannelId>([
	'naver_place',
	'google_business',
	'bing_places',
	'kakao_tmap',
]);

export const NAP_COLLECTION_BLOCKED_NOTE = '데이터 수집 불가(API/스크래핑 차단)';

const UNIT_TOKEN_RE = /(?:제)?\s*\d+\s*(?:층|호|동)/g;
const POSTAL_RE = /\b\d{5}\b/g;

export interface NapMatrixBuildInput {
	brandName?: string;
	brandNameEng?: string;
	address?: string;
	telephone?: string;
	socialLinks?: GuideSocialLinks | null;
	sameAs?: readonly string[];
	collectedUrls?: readonly string[];
	naverPlaceLinked?: boolean;
	googleMapsLinked?: boolean;
	bingPlacesLinked?: boolean;
	kakaoLinked?: boolean;
	/** Per-channel NAP harvested from a place/social scrape. */
	collectedByChannel?: Partial<Record<NapChannelId, NapChannelCollected>>;
	/** LLM-provided status / discrepancy notes keyed by channel. */
	statusOverrides?: Partial<Record<NapChannelId, { status: NapConsistencyStatus; discrepancyNote?: string }>>;
	/** Prefer a stored matrix's collected fields when present. */
	existing?: NapMatrix | null;
}

function parseNapStatus(value: unknown): NapConsistencyStatus | null {
	const raw = String(value || '')
		.trim()
		.toUpperCase();
	if (raw === 'MATCH' || raw === 'WARNING' || raw === 'MISMATCH' || raw === 'NOT_FOUND' || raw === 'UNAVAILABLE') {
		return raw;
	}
	return null;
}

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** UI/LLM placeholders must not count as harvested NAP. */
const EMPTY_NAP_PLACEHOLDER =
	/^(미수집|수집\s*불가(?:\(.*\))?|데이터 수집 불가(?:\(.*\))?|n\/?a|null|undefined|none|-|—|–)$/i;

export function usableNapValue(value: string | null | undefined): string {
	const next = compact(value);
	if (!next || EMPTY_NAP_PLACEHOLDER.test(next)) return '';
	return next;
}

function foldText(value: string): string {
	return compact(value)
		.toLowerCase()
		.replace(/[()[\].,·•'"“”‘’]/g, '')
		.replace(/[-–—]/g, '')
		.replace(/\s+/g, '');
}

function phoneDigits(value: string): string {
	let digits = compact(value).replace(/\D/g, '');
	if (digits.startsWith('82') && digits.length >= 11) {
		digits = `0${digits.slice(2)}`;
	}
	return digits;
}

function stripAddressDecorations(value: string): string {
	return compact(value)
		.replace(POSTAL_RE, ' ')
		.replace(/대한민국|south\s*korea|korea/gi, ' ')
		.replace(UNIT_TOKEN_RE, ' ')
		.replace(/[,]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function nameCore(value: string): string {
	return foldText(value)
		.replace(/\((?:공식|official|youtube|instagram|facebook|channel)[^)]*\)/gi, '')
		.replace(/(?:official|공식채널|공식|youtube|instagram|facebook)/gi, '');
}

function hasCollectedNap(row: NapChannelCollected | null | undefined): boolean {
	if (!row) return false;
	return Boolean(usableNapValue(row.name) || usableNapValue(row.address) || usableNapValue(row.phone));
}

export function hasComparableNap(row: Pick<NapChannelRow, 'collectedName' | 'collectedAddress' | 'collectedPhone'>): boolean {
	return Boolean(usableNapValue(row.collectedName) || usableNapValue(row.collectedAddress) || usableNapValue(row.collectedPhone));
}

export function isUsableNapMatrix(matrix: NapMatrix | null | undefined): matrix is NapMatrix {
	if (!matrix || typeof matrix !== 'object') return false;
	if (!Array.isArray(matrix.rows) || matrix.rows.length === 0) return false;
	return matrix.rows.some((row) => row && typeof row.channelId === 'string');
}

function fieldStatus(
	canonical: string,
	collected: string,
	kind: 'name' | 'address' | 'phone',
): { status: NapConsistencyStatus; note?: string } {
	const rawA = compact(canonical);
	const rawB = compact(collected);
	if (!rawB) return { status: 'NOT_FOUND' };
	if (!rawA) return { status: 'MATCH' };
	if (rawA === rawB) return { status: 'MATCH' };

	if (kind === 'phone') {
		const a = phoneDigits(rawA);
		const b = phoneDigits(rawB);
		if (!b) return { status: 'NOT_FOUND' };
		if (a && a === b) {
			return { status: 'WARNING', note: '전화번호 숫자는 같으나 하이픈·띄어쓰기 표기가 다릅니다.' };
		}
		return { status: 'MISMATCH', note: `대표 전화가 공식 번호(${rawA})와 다릅니다.` };
	}

	if (kind === 'name') {
		if (nameCore(rawA) === nameCore(rawB)) {
			return { status: 'WARNING', note: '상호 핵심은 같으나 띄어쓰기·영문·괄호 표기가 다릅니다.' };
		}
		return { status: 'MISMATCH', note: `상호명 표기('${rawB}')가 공식 상호('${rawA}')와 다릅니다.` };
	}

	const foldedA = foldText(rawA);
	const foldedB = foldText(rawB);
	if (foldedA === foldedB) {
		return { status: 'WARNING', note: '주소 핵심은 같으나 띄어쓰기·구두점 표기가 다릅니다.' };
	}
	if (foldText(stripAddressDecorations(rawA)) === foldText(stripAddressDecorations(rawB))) {
		return { status: 'WARNING', note: '주소 핵심은 같으나 층·호수·동 표기가 다릅니다.' };
	}
	return { status: 'MISMATCH', note: `주소 표기('${rawB}')가 공식 주소('${rawA}')와 다릅니다.` };
}

function worstStatus(statuses: NapConsistencyStatus[]): NapConsistencyStatus {
	if (statuses.includes('MISMATCH')) return 'MISMATCH';
	if (statuses.includes('WARNING')) return 'WARNING';
	if (statuses.includes('NOT_FOUND')) return 'NOT_FOUND';
	return 'MATCH';
}

export function compareChannelNap(
	canonical: { name: string; address: string; phone: string },
	collected: NapChannelCollected,
	channelId: NapChannelId,
	identified: boolean,
): { status: NapConsistencyStatus; discrepancyNote?: string } {
	const name = usableNapValue(collected.name);
	const address = usableNapValue(collected.address);
	const phone = usableNapValue(collected.phone);
	const hasAny = Boolean(name || address || phone);

	if (!hasAny) {
		if (collected.blocked || identified) {
			return {
				status: 'UNAVAILABLE',
				discrepancyNote: compact(collected.blockReason) || NAP_COLLECTION_BLOCKED_NOTE,
			};
		}
		return { status: 'NOT_FOUND', discrepancyNote: '해당 채널에서 사업장 NAP가 식별되지 않았습니다.' };
	}

	const checks: Array<{ status: NapConsistencyStatus; note?: string }> = [];
	if (name) checks.push(fieldStatus(canonical.name, name, 'name'));
	if (address) checks.push(fieldStatus(canonical.address, address, 'address'));
	if (phone) checks.push(fieldStatus(canonical.phone, phone, 'phone'));

	if (PLACE_CHANNELS.has(channelId)) {
		if (!address && canonical.address) {
			checks.push({ status: 'MISMATCH', note: '채널 주소가 비어 있습니다. 공식 도로명 주소를 등록하세요.' });
		}
		if (!phone && canonical.phone) {
			checks.push({ status: 'MISMATCH', note: '채널 대표 전화가 비어 있습니다. 공식 번호를 등록하세요.' });
		}
		if (!name && canonical.name) {
			checks.push({ status: 'MISMATCH', note: '채널 상호명이 비어 있습니다. 공식 상호와 맞추세요.' });
		}
	}

	const status = worstStatus(checks.map((item) => item.status));
	const notes = checks
		.filter((item) => item.status !== 'MATCH' && item.note)
		.map((item) => item.note as string);
	const uniqueNotes = [...new Set(notes)];
	return {
		status,
		discrepancyNote: uniqueNotes.length ? uniqueNotes.join(' ') : undefined,
	};
}

function existingCollected(
	existing: NapMatrix | null | undefined,
	channelId: NapChannelId,
): NapChannelCollected | undefined {
	const row = existing?.rows?.find((item) => item.channelId === channelId);
	if (!row) return undefined;
	const collected: NapChannelCollected = {
		name: usableNapValue(row.collectedName),
		address: usableNapValue(row.collectedAddress),
		phone: usableNapValue(row.collectedPhone),
		blocked: row.status === 'UNAVAILABLE',
		blockReason: row.status === 'UNAVAILABLE' ? compact(row.discrepancyNote) : undefined,
	};
	if (hasCollectedNap(collected)) return collected;
	return collected.blocked ? collected : undefined;
}

function classifyUrls(urls: readonly string[]): {
	youtube?: string;
	instagram?: string;
	facebook?: string;
	naverPlace?: string;
	google?: string;
	bing?: string;
	kakao?: string;
} {
	const out: {
		youtube?: string;
		instagram?: string;
		facebook?: string;
		naverPlace?: string;
		google?: string;
		bing?: string;
		kakao?: string;
	} = {};
	for (const raw of urls) {
		const value = compact(raw);
		if (!value) continue;
		let host = value.toLowerCase();
		try {
			host = new URL(value).hostname.toLowerCase();
		} catch {
			/* keep raw host guess */
		}
		if (!out.youtube && (host.includes('youtube.com') || host.includes('youtu.be'))) out.youtube = value;
		else if (!out.instagram && host.includes('instagram.com')) out.instagram = value;
		else if (!out.facebook && host.includes('facebook.com')) out.facebook = value;
		else if (!out.naverPlace && isNaverPlaceMapUrl(value)) out.naverPlace = value;
		else if (!out.google && isGoogleMapsGbpUrl(value)) out.google = value;
		else if (!out.bing && /bing\.com\/(maps|local)|bingplaces/i.test(value)) out.bing = value;
		else if (!out.kakao && (isKakaoChannelMapUrl(value) || /tmap|t-map/i.test(value))) out.kakao = value;
	}
	return out;
}

export function buildNapRecommendations(
	canonical: { name: string; address: string; phone: string },
	rows: NapChannelRow[],
): NapRecommendation[] {
	const out: NapRecommendation[] = [];
	for (const row of rows) {
		if (row.isCanonical || row.status === 'MATCH' || row.status === 'UNAVAILABLE' || row.status === 'NOT_FOUND') continue;
		if (row.status !== 'WARNING' && row.status !== 'MISMATCH') continue;
		if (!hasComparableNap(row)) continue;
		const bits: string[] = [];
		if (row.collectedName && canonical.name && nameCore(row.collectedName) !== nameCore(canonical.name)) {
			bits.push(`상호를 ${attachQuotedPostposition(canonical.name, '으로/로')} 수정`);
		} else if (row.collectedName && compact(row.collectedName) !== compact(canonical.name)) {
			bits.push(`상호 표기를 공식 표기(${canonical.name})와 동일하게 맞추기`);
		}
		if (row.collectedAddress && canonical.address && foldText(stripAddressDecorations(row.collectedAddress)) !== foldText(stripAddressDecorations(canonical.address))) {
			bits.push(`수집 주소 '${row.collectedAddress}'를 공식 주소 ${attachQuotedPostposition(canonical.address, '으로/로')} 교체`);
		} else if (row.collectedAddress && compact(row.collectedAddress) !== compact(canonical.address)) {
			bits.push(`주소 띄어쓰기·호수 표기를 '${canonical.address}'와 동일하게 정리`);
		} else if (!row.collectedAddress && canonical.address && PLACE_CHANNELS.has(row.channelId)) {
			bits.push(`도로명 주소 '${canonical.address}' 등록`);
		}
		if (row.collectedPhone && canonical.phone && phoneDigits(row.collectedPhone) !== phoneDigits(canonical.phone)) {
			bits.push(`대표 전화를 ${attachQuotedPostposition(canonical.phone, '으로/로')} 수정`);
		} else if (!row.collectedPhone && canonical.phone && PLACE_CHANNELS.has(row.channelId)) {
			bits.push(`대표 전화 '${canonical.phone}' 등록`);
		}
		const action = bits.length ? bits.join(', ') : row.discrepancyNote || '공식 홈페이지 NAP와 문자열을 100% 일치시키세요';
		const brand = canonical.name || '해당 브랜드';
		out.push({
			channelId: row.channelId,
			channelLabel: row.channelLabel,
			prescription: `${row.channelLabel}: ${action}. AI 엔진이 ${withJosa(brand, '을/를')} 하나의 개체로 묶으려면 채널 간 표기가 같아야 합니다.`,
		});
	}
	return out;
}

export function buildNapMatrix(input: NapMatrixBuildInput): NapMatrix {
	const brand = compact(input.brandName);
	const address = compact(input.address);
	const phone = compact(input.telephone);
	const canonical = { name: brand, address, phone };

	const urlPool = [
		...(input.sameAs || []),
		...(input.collectedUrls || []),
		input.socialLinks?.website,
		input.socialLinks?.youtube,
		input.socialLinks?.instagram,
		input.socialLinks?.facebook,
		input.socialLinks?.blog,
	].filter((url): url is string => Boolean(compact(url)));
	const classified = classifyUrls(urlPool);
	const signals = validateChannelSignals(urlPool);

	const identified: Record<NapChannelId, boolean> = {
		homepage: Boolean(brand || address || phone),
		naver_place: Boolean(input.naverPlaceLinked || classified.naverPlace || signals.isNaverPlaceLinked),
		google_business: Boolean(input.googleMapsLinked || classified.google || signals.isGoogleMapsLinked),
		youtube: Boolean(input.socialLinks?.youtube || classified.youtube),
		sns: Boolean(input.socialLinks?.instagram || input.socialLinks?.facebook || classified.instagram || classified.facebook),
		bing_places: Boolean(input.bingPlacesLinked || classified.bing),
		kakao_tmap: Boolean(input.kakaoLinked || classified.kakao || signals.isKakaoLinked),
	};

	const rows: NapChannelRow[] = NAP_CHANNEL_ORDER.map((channelId) => {
		const stored = existingCollected(input.existing, channelId);
		const harvested = input.collectedByChannel?.[channelId];
		let collected: NapChannelCollected = harvested || stored || {};

		if (channelId === 'homepage') {
			collected = {
				name: compact(harvested?.name) || compact(stored?.name) || brand,
				address: compact(harvested?.address) || compact(stored?.address) || address,
				phone: compact(harvested?.phone) || compact(stored?.phone) || phone,
			};
			return {
				channelId,
				channelLabel: NAP_CHANNEL_LABEL[channelId],
				collectedName: compact(collected.name),
				collectedAddress: compact(collected.address),
				collectedPhone: compact(collected.phone),
				status: 'MATCH',
				isCanonical: true,
				discrepancyNote: !address && !phone ? '공식 홈페이지에서 주소·전화가 아직 수집되지 않았습니다.' : undefined,
			};
		}

		const compared = compareChannelNap(canonical, collected, channelId, identified[channelId]);
		const override = input.statusOverrides?.[channelId];
		const emptyHarvest = !hasCollectedNap(collected);
		// Never keep a MATCH/WARNING/MISMATCH override when there is no harvested NAP.
		const status = emptyHarvest
			? collected.blocked || identified[channelId] || compared.status === 'UNAVAILABLE'
				? 'UNAVAILABLE'
				: 'NOT_FOUND'
			: override?.status && override.status !== 'UNAVAILABLE'
				? override.status
				: compared.status;
		return {
			channelId,
			channelLabel: NAP_CHANNEL_LABEL[channelId],
			collectedName: usableNapValue(collected.name),
			collectedAddress: usableNapValue(collected.address),
			collectedPhone: usableNapValue(collected.phone),
			status,
			discrepancyNote:
				status === 'UNAVAILABLE'
					? compact(collected.blockReason) || compared.discrepancyNote || NAP_COLLECTION_BLOCKED_NOTE
					: emptyHarvest
						? compared.discrepancyNote
						: override?.discrepancyNote ?? compared.discrepancyNote,
			isCanonical: false,
		};
	});

	const recommendations = buildNapRecommendations(canonical, rows);
	const consistencyScore = computeConsistencyScore(rows);
	return {
		canonical,
		standard: canonical,
		rows,
		channels: toLlmChannels(rows),
		recommendations,
		consistencyScore,
	};
}

const STATUS_WEIGHT: Record<NapConsistencyStatus, number> = {
	MATCH: 100,
	WARNING: 70,
	MISMATCH: 30,
	NOT_FOUND: 0,
	UNAVAILABLE: 0,
};

export function computeConsistencyScore(rows: NapChannelRow[]): number {
	const scored = rows.filter((row) => !row.isCanonical && row.status !== 'UNAVAILABLE');
	const pool = scored.length ? scored : rows.filter((row) => !row.isCanonical);
	if (!pool.length) return 0;
	const sum = pool.reduce((acc, row) => acc + (STATUS_WEIGHT[row.status] ?? 0), 0);
	return Math.round(sum / pool.length);
}

export function inferChannelIdFromLabel(label: string): NapChannelId | null {
	const hay = compact(label).toLowerCase();
	if (!hay) return null;
	if (/홈페이지|homepage|official\s*site|공식\s*사이트/.test(hay)) return 'homepage';
	if (/네이버|naver/.test(hay)) return 'naver_place';
	if (/구글|google|gbp/.test(hay)) return 'google_business';
	if (/유튜브|youtube/.test(hay)) return 'youtube';
	if (/인스타|instagram|페이스북|facebook|sns/.test(hay)) return 'sns';
	if (/bing/.test(hay)) return 'bing_places';
	if (/카카오|kakao|t맵|t-map|tmap/.test(hay)) return 'kakao_tmap';
	return null;
}

function collectedFromLlmChannel(row: Record<string, unknown>): NapChannelCollected {
	return {
		name: usableNapValue(String(row.targetName ?? row.collectedName ?? row.name ?? '')),
		address: usableNapValue(String(row.targetAddress ?? row.collectedAddress ?? row.address ?? '')),
		phone: usableNapValue(String(row.targetPhone ?? row.collectedPhone ?? row.phone ?? row.telephone ?? '')),
	};
}

export function extractStatusOverrides(
	value: unknown,
): Partial<Record<NapChannelId, { status: NapConsistencyStatus; discrepancyNote?: string }>> | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const raw = value as Record<string, unknown>;
	const channelList = Array.isArray(raw.channels)
		? raw.channels
		: Array.isArray(raw.rows)
			? raw.rows
			: null;
	if (!channelList?.length) return undefined;
	const out: Partial<Record<NapChannelId, { status: NapConsistencyStatus; discrepancyNote?: string }>> = {};
	for (const item of channelList) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const id =
			(typeof row.channelId === 'string' && NAP_CHANNEL_ORDER.includes(row.channelId as NapChannelId)
				? (row.channelId as NapChannelId)
				: inferChannelIdFromLabel(String(row.channelName ?? row.channelLabel ?? ''))) || null;
		if (!id || id === 'homepage') continue;
		const status = parseNapStatus(row.status);
		if (!status) continue;
		out[id] = {
			status,
			discrepancyNote: compact(String(row.discrepancyNote ?? '')) || undefined,
		};
	}
	return Object.keys(out).length ? out : undefined;
}

export function extractCollectedByChannel(value: unknown): Partial<Record<NapChannelId, NapChannelCollected>> | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const raw = value as Record<string, unknown>;
	const out: Partial<Record<NapChannelId, NapChannelCollected>> = {};

	const channelList = Array.isArray(raw.channels)
		? raw.channels
		: Array.isArray(raw.rows)
			? raw.rows
			: null;
	if (channelList) {
		for (const item of channelList) {
			if (!item || typeof item !== 'object') continue;
			const row = item as Record<string, unknown>;
			const id =
				(typeof row.channelId === 'string' && NAP_CHANNEL_ORDER.includes(row.channelId as NapChannelId)
					? (row.channelId as NapChannelId)
					: inferChannelIdFromLabel(String(row.channelName ?? row.channelLabel ?? ''))) || null;
			if (!id) continue;
			const collected = collectedFromLlmChannel(row);
			if (hasCollectedNap(collected)) out[id] = collected;
		}
	}

	const mapped = asCollectedMap(raw.collectedByChannel || raw);
	if (mapped) {
		for (const [id, collected] of Object.entries(mapped) as Array<[NapChannelId, NapChannelCollected]>) {
			if (!out[id] && hasCollectedNap(collected)) out[id] = collected;
		}
	}
	return Object.keys(out).length ? out : undefined;
}

export function toLlmChannels(rows: NapChannelRow[]): Array<{
	channelName: string;
	targetName: string;
	targetAddress: string;
	targetPhone: string;
	status: NapConsistencyStatus;
	discrepancyNote: string;
}> {
	return rows.map((row) => ({
		channelName: row.channelLabel,
		targetName: row.collectedName,
		targetAddress: row.collectedAddress,
		targetPhone: row.collectedPhone,
		status: row.status,
		discrepancyNote: row.discrepancyNote || '',
	}));
}

export function hasNapIdentity(input?: NapMatrixBuildInput | null): boolean {
	if (!input) return false;
	return Boolean(
		compact(input.brandName) ||
			compact(input.address) ||
			compact(input.telephone) ||
			compact(input.socialLinks?.website),
	);
}

/** Always returns a matrix when identity or a payload exists. */
export function resolveNapMatrix(value: unknown, fallbackInput?: NapMatrixBuildInput): NapMatrix | undefined {
	const parsed = sanitizeNapMatrix(value, fallbackInput);
	if (parsed) return parsed;
	if (fallbackInput && hasNapIdentity(fallbackInput)) return buildNapMatrix(fallbackInput);
	return undefined;
}

export function hydrateReportNapMatrix(report: AuditReport | null | undefined): AuditReport | null | undefined {
	if (!report) return report;
	const existing = (report as AuditReport & { napMatrix?: NapMatrix }).napMatrix;
	const next = resolveNapMatrix(existing, inputFromReport(report)) || buildNapMatrixFromReport(report, existing);
	if (!next) return report;
	return { ...report, napMatrix: next };
}

function asCollectedMap(value: unknown): Partial<Record<NapChannelId, NapChannelCollected>> | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const out: Partial<Record<NapChannelId, NapChannelCollected>> = {};
	for (const id of NAP_CHANNEL_ORDER) {
		const row = (value as Record<string, NapChannelCollected>)[id];
		if (!row || typeof row !== 'object') continue;
		out[id] = {
			name: usableNapValue(row.name),
			address: usableNapValue(row.address),
			phone: usableNapValue((row as NapChannelCollected & { telephone?: string }).phone || (row as { telephone?: string }).telephone),
			blocked: Boolean(row.blocked),
			blockReason: compact(row.blockReason) || undefined,
		};
	}
	return Object.keys(out).length ? out : undefined;
}

function standardFromPayload(raw: Record<string, unknown>, fallbackInput?: NapMatrixBuildInput) {
	const standard =
		raw.standard && typeof raw.standard === 'object'
			? (raw.standard as Record<string, unknown>)
			: raw.canonical && typeof raw.canonical === 'object'
				? (raw.canonical as Record<string, unknown>)
				: {};
	return {
		brandName: compact(String(standard.name ?? '')) || fallbackInput?.brandName,
		address: compact(String(standard.address ?? '')) || fallbackInput?.address,
		telephone: compact(String(standard.phone ?? standard.telephone ?? '')) || fallbackInput?.telephone,
	};
}

export function inputFromReport(report: AuditReport | null | undefined): NapMatrixBuildInput {
	const meta = report?.siteMeta;
	const signals = report ? extractSignalsFromReport(report) : null;
	const extra = [...(signals?.sameAs || []), ...(signals?.collectedUrls || []), signals?.footerText || ''].join('\n');
	const platform = report
		? detectEnginePlatformSignals({
				schemaTypes: signals?.schemaTypes,
				jsonLdCorpus: signals?.jsonLdCorpus,
				extraCorpus: extra,
				sameAs: signals?.sameAs,
			})
		: null;
	let brandName = compact(meta?.brandName || meta?.organizationName || '');
	if (!brandName && report?.url) {
		try {
			brandName = compact(resolveProjectSiteName(report));
		} catch {
			brandName = '';
		}
	}
	const address =
		compact(meta?.address) ||
		[meta?.addressRegion, meta?.addressLocality, meta?.streetAddress].filter(Boolean).join(' ');
	const storedMatrix = (report as AuditReport & { napMatrix?: NapMatrix } | undefined)?.napMatrix;
	return {
		brandName,
		brandNameEng: [meta?.organizationName, meta?.ogSiteName].find(
			(name) => name && /[a-z]/i.test(name) && !/[가-힣]/.test(name),
		),
		address,
		telephone: meta?.telephone,
		sameAs: meta?.sameAs || signals?.sameAs,
		collectedUrls: report?.collectedUrls || signals?.collectedUrls,
		socialLinks: { website: report?.url },
		naverPlaceLinked: platform?.naverPlaceLinked,
		googleMapsLinked: platform?.googleMapsLinked,
		bingPlacesLinked: platform?.bingPlacesLinked,
		kakaoLinked: validateChannelSignals([...(meta?.sameAs || []), ...(report?.collectedUrls || [])]).isKakaoLinked,
		collectedByChannel: extractCollectedByChannel(
			(report as AuditReport & { collectedNap?: unknown })?.collectedNap ||
				(meta as { collectedNap?: unknown } | undefined)?.collectedNap ||
				storedMatrix,
		),
		statusOverrides: extractStatusOverrides(storedMatrix),
		existing: storedMatrix,
	};
}

export function sanitizeNapMatrix(value: unknown, fallbackInput?: NapMatrixBuildInput): NapMatrix | undefined {
	if (!value || typeof value !== 'object') {
		return fallbackInput && hasNapIdentity(fallbackInput) ? buildNapMatrix(fallbackInput) : undefined;
	}
	const raw = value as NapMatrix & { collectedByChannel?: unknown; standard?: { name?: string; address?: string; phone?: string } };
	const fromStandard = standardFromPayload(raw as unknown as Record<string, unknown>, fallbackInput);
	const harvested = extractCollectedByChannel(raw) || asCollectedMap(raw.collectedByChannel);
	const statusOverrides = {
		...(fallbackInput?.statusOverrides || {}),
		...(extractStatusOverrides(raw) || {}),
	};
	const existing = isUsableNapMatrix(raw) ? raw : fallbackInput?.existing;
	const input: NapMatrixBuildInput = {
		...(fallbackInput || {}),
		brandName: compact(fallbackInput?.brandName) || fromStandard.brandName || fallbackInput?.brandName,
		address: compact(fallbackInput?.address) || fromStandard.address || fallbackInput?.address,
		telephone: compact(fallbackInput?.telephone) || fromStandard.telephone || fallbackInput?.telephone,
		existing,
		collectedByChannel: harvested || fallbackInput?.collectedByChannel,
		statusOverrides: Object.keys(statusOverrides).length ? statusOverrides : fallbackInput?.statusOverrides,
	};
	if (!hasNapIdentity(input) && !harvested && !existing) return undefined;
	const built = buildNapMatrix(input);
	const requestedScore = Number((raw as { consistencyScore?: unknown }).consistencyScore);
	if (Number.isFinite(requestedScore)) {
		return { ...built, consistencyScore: Math.min(100, Math.max(0, Math.round(requestedScore))) };
	}
	return built;
}

export function buildNapMatrixFromReport(report: AuditReport | null | undefined, existing?: NapMatrix | null): NapMatrix | undefined {
	if (!report?.url && !report?.siteMeta && !existing) return undefined;
	const stored =
		existing ||
		((report as AuditReport & { napMatrix?: NapMatrix } | undefined)?.napMatrix ?? null);
	return resolveNapMatrix(stored, inputFromReport(report));
}

export function napStatusLabel(status: NapConsistencyStatus): string {
	if (status === 'MATCH') return '100% 일치';
	if (status === 'WARNING') return '표기 상이';
	if (status === 'MISMATCH') return '불일치';
	if (status === 'UNAVAILABLE') return '수집 불가(플랫폼 보안)';
	return '채널 미식별';
}
