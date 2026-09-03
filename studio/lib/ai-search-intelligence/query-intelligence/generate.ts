/**
 * Universal Query Generator.
 * Fills intent templates from the current Target Context only.
 * Missing dimensions are skipped — never replaced with a vertical default.
 */
import {
	QUERY_INTENTS,
	queryIntentToAsi,
	queryIntentToSovCategory,
	type QueryIntent,
} from '@/lib/ai-search-intelligence/query-intelligence/intents';
import type { AsiTargetContext } from '@/lib/ai-search-intelligence/target/context';
import {
	intelligenceIsMedicalCorpus,
	intelligenceOrgNoun,
} from '@/lib/ai-search-intelligence/target/site-intelligence-derive';
import type {
	AsiGeneratedQuestion,
	AsiQueryContextReport,
	AsiQueryContextSource,
	AsiQueryGeneration,
	AsiQueryGenerationStatus,
	AsiQuestionIntent,
	AsiSovCategory,
} from '@/lib/ai-search-intelligence/types';

export type UniversalQueryItem = {
	query: string;
	intent: QueryIntent;
	asiIntent: AsiQuestionIntent;
	category: AsiSovCategory;
	used: {
		industry: boolean;
		location: boolean;
		service: boolean;
		audience: boolean;
		brand: boolean;
	};
};

export type UniversalQueryResult = {
	status: AsiQueryGenerationStatus;
	items: UniversalQueryItem[];
	context: AsiQueryContextReport;
};

export type UniversalQueryOptions = {
	limit?: number;
	hasQuestionOverrides?: boolean;
};

function trim(value: string | undefined | null): string {
	return (value || '').trim();
}

function phrase(...parts: Array<string | undefined | null>): string {
	return parts.map((part) => trim(part)).filter(Boolean).join(' ');
}

function containsToken(query: string, value: string): boolean {
	const token = value.trim();
	if (!token) return false;
	return query.toLowerCase().includes(token.toLowerCase());
}

function usedFlags(
	query: string,
	parts: { industry: string; location: string; service: string; audience: string; brand: string },
): UniversalQueryItem['used'] {
	return {
		industry: containsToken(query, parts.industry),
		location: containsToken(query, parts.location),
		service: containsToken(query, parts.service),
		audience: containsToken(query, parts.audience),
		brand: containsToken(query, parts.brand),
	};
}

function sourceOf(fromQuestions: boolean, fromAudit: boolean, present: boolean): AsiQueryContextSource {
	if (!present) return 'none';
	if (fromQuestions) return 'questions';
	if (fromAudit) return 'audit';
	return 'site';
}

export function reportTargetContext(
	context: AsiTargetContext,
	overrides?: { industry?: boolean; location?: boolean; services?: boolean; target?: boolean },
): AsiQueryContextReport {
	const industry = trim(context.industry) || trim(context.category) || null;
	const location = trim(context.location) || null;
	const services = context.services.map((item) => item.trim()).filter(Boolean);
	const target = trim(context.targetAudience) || null;
	return {
		industry,
		location,
		services,
		target,
		intents: [...QUERY_INTENTS],
		sources: {
			industry: sourceOf(Boolean(overrides?.industry), context.boundFromAudit, Boolean(industry)),
			location: sourceOf(Boolean(overrides?.location), context.boundFromAudit, Boolean(location)),
			services: sourceOf(Boolean(overrides?.services), context.boundFromAudit, services.length > 0),
			target: sourceOf(Boolean(overrides?.target), false, Boolean(target)),
		},
	};
}

export function resolveQueryGenerationStatus(
	context: AsiTargetContext,
	itemCount: number,
	options?: UniversalQueryOptions,
): AsiQueryGenerationStatus {
	const industry = trim(context.industry) || trim(context.category);
	const location = trim(context.location);
	const services = context.services.filter(Boolean);
	const hasSubject = Boolean(industry || services.length);
	const hasAnalysis = context.boundFromAudit || Boolean(options?.hasQuestionOverrides);
	if (!hasAnalysis && !hasSubject) return 'NO_DATA';
	if (!itemCount) return hasSubject || hasAnalysis ? 'GENERATION_FAILED' : 'NO_DATA';
	if (!hasSubject) return 'CONTEXT_INCOMPLETE';
	if (!location && services.length === 0 && !trim(context.targetAudience) && !hasAnalysis) {
		return 'CONTEXT_INCOMPLETE';
	}
	return 'QUERY_GENERATED';
}

function candidatesFor(
	intent: QueryIntent,
	parts: {
		industry: string;
		location: string;
		service: string;
		audience: string;
		brand: string;
		subject: string;
		keyword: string;
		orgNoun: string;
		medical: boolean;
	},
): string[] {
	const { industry, location, service, audience, brand, subject, keyword, orgNoun, medical } = parts;
	if (intent === 'discovery') {
		return [
			keyword && orgNoun ? phrase(keyword, orgNoun, '추천') : '',
			keyword && medical ? phrase(keyword, '최신 치료법 신뢰할 만한 곳') : '',
			phrase(location, subject),
			phrase(industry, service),
			phrase(subject),
		].filter(Boolean);
	}
	if (intent === 'recommendation') {
		return [
			keyword && orgNoun ? phrase('국내', keyword, '전문 연구 기관 어디가 좋나요?') : '',
			keyword ? phrase('국내', keyword, '어디가 좋나요?') : '',
			phrase(location, subject, '추천'),
			audience && service ? phrase(audience, service, '추천') : '',
			phrase(subject, '추천'),
			!subject && brand ? phrase(brand, '추천') : '',
		].filter(Boolean);
	}
	if (intent === 'comparison') {
		return [
			brand && (industry || keyword)
				? phrase(brand, '과 타', industry || `${keyword} ${orgNoun || '기관'}`.trim(), '차이점')
				: '',
			phrase(location, subject, '비교'),
			phrase(subject, '비교'),
			!subject && brand ? phrase(brand, '비교') : '',
		].filter(Boolean);
	}
	if (intent === 'local') {
		if (!location) return [];
		return [phrase(location, '근처', subject || brand), phrase(location, subject || brand)].filter(Boolean);
	}
	if (intent === 'service') {
		if (!service) return [];
		return [phrase(location, service), phrase(service, '잘하는 곳'), audience ? phrase(audience, service) : ''].filter(Boolean);
	}
	if (intent === 'problem') {
		if (!service && !industry) return [];
		return [
			service ? phrase(service, '문제 있으면 어디로') : '',
			industry || service ? phrase(industry || service, service && industry !== service ? service : '', '상담은 어디서') : '',
		].filter(Boolean);
	}
	if (intent === 'expertise') {
		if (!service && !industry) return [];
		return [phrase(location, service || industry, '전문'), phrase(service || industry, '전문성')].filter(Boolean);
	}
	if (intent === 'trust') {
		return [
			subject ? phrase(location, subject, '믿을 수 있는') : '',
			brand ? phrase(brand, '후기') : '',
			subject ? phrase(subject, '신뢰') : '',
		].filter(Boolean);
	}
	return [location && brand ? phrase(location, brand) : '', brand ? `${brand} 어떤 곳` : '', brand ? `${brand} 후기` : ''].filter(
		Boolean,
	);
}

export function generateUniversalQueries(
	context: AsiTargetContext,
	options?: UniversalQueryOptions,
): UniversalQueryResult {
	const industry = trim(context.industry) || trim(context.category);
	const location = trim(context.location);
	const services = context.services.map((item) => item.trim()).filter((item) => item && item !== industry);
	const service = services[0] || (trim(context.category) && trim(context.category) !== industry ? trim(context.category) : '');
	const audience = trim(context.targetAudience);
	const brand = trim(context.brandName);
	const subject = industry || service || brand;
	const keyword = (context.keywords ?? []).map((item) => trim(item)).find(Boolean) || service || industry;
	const corpus = [industry, location, service, audience, brand, ...(context.keywords ?? []), ...services].join(' ');
	const parts = {
		industry,
		location,
		service,
		audience,
		brand,
		subject,
		keyword,
		orgNoun: intelligenceOrgNoun(corpus),
		medical: intelligenceIsMedicalCorpus(corpus),
	};
	const report = reportTargetContext(context, {
		industry: Boolean(trim(context.industry) && options?.hasQuestionOverrides),
		location: Boolean(location && options?.hasQuestionOverrides),
		services: Boolean((service || services.length) && options?.hasQuestionOverrides),
		target: Boolean(audience && options?.hasQuestionOverrides),
	});
	const seen = new Set<string>();
	const items: UniversalQueryItem[] = [];
	const limit = Math.max(1, Math.min(24, options?.limit ?? 16));

	for (const intent of QUERY_INTENTS) {
		for (const query of candidatesFor(intent, parts)) {
			const text = query.trim();
			if (!text) continue;
			const key = text.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			items.push({
				query: text,
				intent,
				asiIntent: queryIntentToAsi(intent),
				category: queryIntentToSovCategory(intent, text),
				used: usedFlags(text, parts),
			});
			if (items.length >= limit) break;
		}
		if (items.length >= limit) break;
	}

	const status = resolveQueryGenerationStatus(context, items.length, options);
	return {
		status,
		items,
		context: { ...report, intents: [...new Set(items.map((item) => item.intent))] },
	};
}

export function universalQueriesToQuestions(items: readonly UniversalQueryItem[]): AsiGeneratedQuestion[] {
	return items.map((item, index) => ({
		id: `${item.intent}-${index}`,
		intent: item.asiIntent,
		query: item.query,
	}));
}

export function toQueryGeneration(result: UniversalQueryResult): AsiQueryGeneration {
	return {
		status: result.status,
		context: result.context,
		count: result.items.length,
	};
}

export function questionInputsFromContext(context: AsiTargetContext): {
	industry: string;
	location: string;
	service: string;
	target: string;
} {
	return {
		industry: trim(context.industry) || trim(context.category),
		location: trim(context.location),
		service: context.services.find((item) => item && item !== (context.industry || context.category)) || context.services[0] || trim(context.category),
		target: trim(context.targetAudience),
	};
}
