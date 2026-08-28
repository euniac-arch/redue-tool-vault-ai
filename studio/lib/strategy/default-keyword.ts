import { buildRecommendedKeywordGroups, type RecommendedKeywordGroups } from '@/lib/strategy/recommended-keywords';
import type {
	StrategyAuditContext,
	StrategyIndustryProfileRef,
	StrategyLang,
	TargetKeywordState,
} from '@/lib/strategy/types';

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function joinQuery(parts: Array<string | null | undefined>): string {
	return parts.map((part) => compact(part)).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

const FALLBACK_RECOMMEND: Record<string, { ko: string; en: string }> = {
	general: { ko: '추천', en: 'recommended' },
};

export function fallbackIndustryKeyword(
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	lang: StrategyLang,
): string {
	const location = compact(ctx.localSignals.broadLocation) || compact(ctx.location);
	const industry = compact(ctx.subIndustry) || compact(profile.label) || compact(ctx.industry);
	const base = joinQuery([location, industry]);
	if (!base) return '';
	const suffix = FALLBACK_RECOMMEND[profile.registryType];
	if (!suffix) return base;
	return joinQuery([base, lang === 'en' ? suffix.en : suffix.ko]);
}

export function resolveStrategyDefaultKeyword(input: {
	queryKeyword?: string | null;
	groups: RecommendedKeywordGroups;
	ctx: StrategyAuditContext;
	profile: StrategyIndustryProfileRef;
	lang: StrategyLang;
}): string {
	const fromQuery = compact(input.queryKeyword);
	if (fromQuery) return fromQuery;

	const broad = input.groups.broad?.length ? input.groups.broad : input.groups.metro;
	if (broad?.[0]) return broad[0];

	const recommended = input.groups.recommended?.length ? input.groups.recommended : input.groups.aeo;
	if (recommended?.[0]) return recommended[0];

	return fallbackIndustryKeyword(input.ctx, input.profile, input.lang);
}

export function placeholderKeywordExamples(groups: RecommendedKeywordGroups, limit = 3): string {
	const broad = groups.broad?.length ? groups.broad : groups.metro;
	return (broad || []).slice(0, limit).join(', ');
}

export function seedTargetKeywordFromContext(
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	lang: StrategyLang,
	queryKeyword?: string | null,
): TargetKeywordState {
	const groups = buildRecommendedKeywordGroups(ctx, profile, lang);
	const value = resolveStrategyDefaultKeyword({ queryKeyword, groups, ctx, profile, lang });
	return { seed: value || null, value: value || '' };
}
