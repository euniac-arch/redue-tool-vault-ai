import { emptyAiEngineDiagnoses, emptyChannelBriefing } from '@/lib/analysis/evaluateAiBottlenecks';
import { sanitizeGuideScores } from '@/lib/guide/scores';
import { emptyGuideData } from '@/lib/guide/sample';
import { createGuideId, suggestGuideSlug } from '@/lib/guide/slug';
import type { AiEngineDiagnosis, GuideData, GuideFaq, GuideSocialLinks } from '@/lib/guide/types';

function asText(value: unknown, fallback = ''): string {
	if (typeof value === 'string') return value;
	if (value == null) return fallback;
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return fallback;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		if (typeof value === 'string' && value.trim()) {
			return value.split(/[,#\n]/).map((item) => item.trim()).filter(Boolean);
		}
		return [];
	}
	return value.map((item) => asText(item).trim()).filter(Boolean);
}

function asSocialLinks(value: unknown): GuideSocialLinks {
	if (!value || typeof value !== 'object') return {};
	const row = value as GuideSocialLinks;
	return {
		website: asText(row.website) || undefined,
		youtube: asText(row.youtube) || undefined,
		instagram: asText(row.instagram) || undefined,
		facebook: asText(row.facebook) || undefined,
		blog: asText(row.blog) || undefined,
	};
}

function asFaq(value: unknown): GuideFaq {
	const row = value && typeof value === 'object' ? (value as GuideFaq) : { question: '', answer: '' };
	return {
		question: asText(row.question),
		answer: asText(row.answer),
	};
}

function asDiagnoses(value: unknown): AiEngineDiagnosis[] {
	const empty = emptyAiEngineDiagnoses();
	const list = Array.isArray(value)
		? value
		: value && typeof value === 'object'
			? Object.values(value as Record<string, AiEngineDiagnosis>)
			: [];
	if (!list.length) return empty;
	return empty.map((fallback) => {
		const row = list.find((item) => item && item.engine === fallback.engine) || list[empty.indexOf(fallback)];
		if (!row || typeof row !== 'object') return fallback;
		const status = row.status === 'OPTIMAL' || row.status === 'CRITICAL' ? row.status : row.status === 'WARNING' ? 'WARNING' : fallback.status;
		return {
			...fallback,
			...row,
			engine: fallback.engine,
			engineName: asText(row.engineName, fallback.engineName),
			category: asText(row.category, fallback.category),
			status,
			statusText: asText(row.statusText, fallback.statusText),
			detectedCause: asText(row.detectedCause, fallback.detectedCause),
			actionItems: asStringArray(row.actionItems).length ? asStringArray(row.actionItems) : fallback.actionItems,
		};
	});
}

/** Always returns a render-safe GuideData. Never throws. */
export function ensureGuideData(input?: Partial<GuideData> | null): GuideData {
	const empty = emptyGuideData();
	const raw = input && typeof input === 'object' ? input : {};
	const merged: GuideData = {
		...empty,
		...raw,
		brandName: asText(raw.brandName),
		brandNameEng: asText(raw.brandNameEng),
		industry: asText(raw.industry),
		region: asText(raw.region),
		address: asText(raw.address),
		telephone: asText(raw.telephone),
		coreFeatures: asStringArray(raw.coreFeatures),
		keywords: asStringArray(raw.keywords),
		socialLinks: asSocialLinks(raw.socialLinks),
		faq: asFaq(raw.faq),
		createdAt: asText(raw.createdAt, empty.createdAt || new Date().toISOString()),
	};
	const scores = sanitizeGuideScores(merged);
	const briefing = emptyChannelBriefing();
	return {
		...merged,
		id: asText(raw.id) || createGuideId(),
		slug: asText(raw.slug).trim().toLowerCase() || suggestGuideSlug(merged.brandNameEng, merged.brandName),
		...scores,
		channelBriefing: {
			aiSearch: { ...briefing.aiSearch, ...raw.channelBriefing?.aiSearch },
			googleSearch: { ...briefing.googleSearch, ...raw.channelBriefing?.googleSearch },
			naverPlace: { ...briefing.naverPlace, ...raw.channelBriefing?.naverPlace },
		},
		aiEngineDiagnoses: asDiagnoses(raw.aiEngineDiagnoses),
	};
}
