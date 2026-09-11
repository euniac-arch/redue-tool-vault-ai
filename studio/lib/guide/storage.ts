import { emptyAiEngineDiagnoses, emptyChannelBriefing } from '@/lib/analysis/evaluateAiBottlenecks';
import { emptyGuideData, NINEONE_GUIDE_SAMPLE } from '@/lib/guide/sample';
import { sanitizeGuideScores } from '@/lib/guide/scores';
import { GUIDE_DRAFT_KEY, GUIDE_STORAGE_KEY, type GuideData } from '@/lib/guide/types';

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function isGuideData(value: unknown): value is GuideData {
	if (!value || typeof value !== 'object') return false;
	const row = value as Partial<GuideData>;
	return typeof row.slug === 'string' && typeof row.brandName === 'string';
}

function normalizeGuideData(row: GuideData): GuideData {
	const empty = emptyGuideData();
	return {
		...empty,
		...row,
		coreFeatures: row.coreFeatures || [],
		keywords: row.keywords || [],
		telephone: row.telephone || '',
		...sanitizeGuideScores(row),
		channelBriefing: {
			aiSearch: { ...emptyChannelBriefing().aiSearch, ...row.channelBriefing?.aiSearch },
			googleSearch: { ...emptyChannelBriefing().googleSearch, ...row.channelBriefing?.googleSearch },
			naverPlace: { ...emptyChannelBriefing().naverPlace, ...row.channelBriefing?.naverPlace },
		},
		socialLinks: row.socialLinks || {},
		faq: row.faq || { question: '', answer: '' },
		aiEngineDiagnoses:
			Array.isArray(row.aiEngineDiagnoses) && row.aiEngineDiagnoses.length
				? row.aiEngineDiagnoses
				: emptyAiEngineDiagnoses(),
		napMatrix: row.napMatrix,
	};
}

function readPool(): Record<string, GuideData> {
	if (!isBrowser()) return {};
	try {
		const raw = window.localStorage.getItem(GUIDE_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const pool: Record<string, GuideData> = {};
		for (const [slug, row] of Object.entries(parsed)) {
			if (isGuideData(row)) pool[slug] = normalizeGuideData(row);
		}
		return pool;
	} catch {
		return {};
	}
}

function writePool(pool: Record<string, GuideData>) {
	if (!isBrowser()) return;
	try {
		window.localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(pool));
	} catch {
		// quota / private mode
	}
}

export function listSavedGuides(): GuideData[] {
	return Object.values(readPool()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function saveGuide(data: GuideData): GuideData {
	const slug = data.slug.trim().toLowerCase();
	const next: GuideData = {
		...normalizeGuideData(data),
		slug,
		id: data.id || slug,
		createdAt: data.createdAt || new Date().toISOString(),
	};
	const pool = readPool();
	pool[slug] = next;
	writePool(pool);
	return next;
}

export function getGuideBySlug(slug: string): GuideData | null {
	const key = slug.trim().toLowerCase();
	if (!key) return null;
	const saved = readPool()[key];
	if (saved) return saved;
	if (key === NINEONE_GUIDE_SAMPLE.slug) return NINEONE_GUIDE_SAMPLE;
	return null;
}

export function saveGuideDraft(data: GuideData) {
	if (!isBrowser()) return;
	try {
		window.localStorage.setItem(GUIDE_DRAFT_KEY, JSON.stringify(data));
	} catch {
		// ignore
	}
}

export function loadGuideDraft(): GuideData | null {
	if (!isBrowser()) return null;
	try {
		const raw = window.localStorage.getItem(GUIDE_DRAFT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as unknown;
		return isGuideData(parsed) ? normalizeGuideData(parsed) : null;
	} catch {
		return null;
	}
}

export function clearGuideDraft() {
	if (!isBrowser()) return;
	try {
		window.localStorage.removeItem(GUIDE_DRAFT_KEY);
	} catch {
		// ignore
	}
}

/** Built-in mock pool used when localStorage has no matching slug. */
export const GUIDE_MOCK_POOL: Record<string, GuideData> = {
	[NINEONE_GUIDE_SAMPLE.slug]: NINEONE_GUIDE_SAMPLE,
};
